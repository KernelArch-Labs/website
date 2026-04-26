import { useState, useEffect, useRef, useMemo } from "react";

/* ============================================================================
   ASTRA RUNTIME — interactive landing page

   A self-contained section that explains Astra to a layman:
     - the problem it solves
     - the 6-layer / 21-module architecture (click any module to see it)
     - how modules depend on and integrate with each other
     - a step-through walkthrough of process spawn (M-01 + M-02)
     - a comparison vs the existing landscape (Docker / gVisor / Firecracker / seL4)
     - the publication roadmap (5 papers across 18 months)

   Pure React + inline SVG, no external charting deps. Uses the same colour
   palette + Hungarian naming as kernel-arch-labs.jsx so it slots in cleanly.
   ============================================================================ */

const CLR = {
  szRed: "#c0392b",
  szRedDark: "#922b21",
  szRedLight: "#e74c3c",
  szBg: "#f2f1ef",
  szSurface: "#eaeae8",
  szCard: "#ffffff",
  szCardHover: "#fafafa",
  szTextPrimary: "#1a1a1a",
  szTextSecondary: "#5a5a5a",
  szTextDim: "#999999",
  szBorder: "#d8d8d6",
  szBorderHover: "#b0b0ae",
  szGreen: "#27ae60",
  szAmber: "#d69e2e",
};

// ---- module + layer data --------------------------------------------------

const LAYERS = [
  {
    iId: 1,
    szName: "Core",
    szTagline: "The trusted nucleus",
    szPlain: "The runtime's nervous system. Every other layer talks through here. Holds capability tokens, the service registry, the process manager, and the assembly-level crypto primitives.",
    vModules: ["M-01", "M-21"],
  },
  {
    iId: 2,
    szName: "Services",
    szTagline: "What the runtime does day-to-day",
    szPlain: "The four shipping services: namespace isolation, zero-copy IPC, hardened memory allocation, and eBPF observability. Each one is a class implementing the IService interface, registered with the runtime at startup.",
    vModules: ["M-02", "M-03", "M-06", "M-09"],
  },
  {
    iId: 3,
    szName: "Security",
    szTagline: "Detection + recovery",
    szPlain: "Reserved for checkpoint, replay, and verification. The plan: snapshot a process, replay it deterministically for forensic analysis, and verify the capability model with formal proofs.",
    vModules: ["M-04", "M-05", "M-12"],
  },
  {
    iId: 4,
    szName: "Intelligence",
    szTagline: "Learn from the runtime",
    szPlain: "AI scheduler, hardware abstraction, profiler. Reserved scaffolding today; year-1 plan keeps a narrow learned-allocator slice as the only shipping AI work.",
    vModules: ["M-08", "M-16", "M-17"],
  },
  {
    iId: 5,
    szName: "Application",
    szTagline: "Run real workloads",
    szPlain: "Job engine, WebAssembly sandbox, the Astra Query Language, and Raft consensus for distributed clusters. All reserved for later phases.",
    vModules: ["M-07", "M-10", "M-11", "M-15"],
  },
  {
    iId: 6,
    szName: "Infrastructure",
    szTagline: "I/O + crypto + module loading",
    szPlain: "Network stack, virtual filesystem, post-quantum crypto, virtual time, and the signed module loader. Reserved for phases 7 and 8.",
    vModules: ["M-13", "M-14", "M-18", "M-19", "M-20"],
  },
];

const MODULES = [
  // ===== BUILT =====
  {
    szId: "M-01", iLayer: 1, szName: "Core Runtime", szStatus: "built",
    szShort: "Capability tokens + service registry + event bus + process manager.",
    szPlain: "The brain. Hands out unforgeable permission tokens, keeps the list of running services, dispatches events, and supervises every child process the runtime spawns.",
    vDepends: ["M-21"], vUsedBy: ["M-02", "M-03", "M-06", "M-09"],
    szRole: "Every other layer routes through it.",
    vScenarios: [
      { szTitle: "Bootstrap the runtime", szBody: "Runtime::init() pre-allocates four pools — 4096 capability tokens, 64 service slots, 256 process descriptors, 1024 event slots — all on the heap up-front. After this, the steady-state runtime never calls malloc on a hot path." },
      { szTitle: "Derive a child capability", szBody: "Service A holds a token with IPC_SEND + IPC_RECV + MEM_ALLOC. It calls capabilities.derive(parent, IPC_SEND, ownerId=42) to give a worker thread a strict subset. The runtime mints a new token whose epoch is anchored to the parent's — revoke the parent and the child dies in the same atomic operation." },
      { szTitle: "Register a service with dependencies", szBody: "EbpfService::getDependencies() returns {ModuleId::CORE}. ServiceRegistry topo-sorts the registered services and starts them in order: core first, then services that depend on core, etc. If you wire a cycle, registration fails up-front." },
      { szTitle: "Publish + subscribe on the EventBus", szBody: "M-09 subscribes to PROCESS_SPAWNED at startup. M-01's ProcessManager publishes that event on every successful fork+exec. The bus is a lock-free ring buffer of 64-byte events — one cache line — so publish is one atomic store and dispatch is O(subscribers)." },
    ],
  },
  {
    szId: "M-21", iLayer: 1, szName: "ASM Core", szStatus: "built",
    szShort: "Hand-tuned x86 primitives: ct_compare, ct_select, secure_wipe, rdrand64, lfence, cache_flush, stack_canary.",
    szPlain: "A tiny set of crypto and memory primitives. Currently shipping as C++ stubs with the same ABI; the NASM ports replace them before Paper 1's submission to make the constant-time claims defensible. If these leak via timing, the whole capability story falls apart, so they sit at the very bottom.",
    vDepends: [], vUsedBy: ["M-01", "M-18"],
    szRole: "Foundation. No upstream dependencies.",
    vScenarios: [
      { szTitle: "Constant-time token compare", szBody: "Two 16-byte capability IDs need to be compared. A naive memcmp leaks: it returns early on the first byte mismatch, leaking timing data. ct_compare(a, b, 16) loops the full length unconditionally — same number of cycles whether the tokens differ in byte 0 or byte 15." },
      { szTitle: "Secure-wipe a revoked token", szBody: "When CapabilityManager.revoke() bumps the epoch, the old token's bytes need to be erased. memset would be optimised away by the compiler. secure_wipe uses a volatile-byte loop in assembly that the optimiser can't elide." },
      { szTitle: "Generate a 64-bit random ID", szBody: "rdrand64 issues the RDRAND instruction directly. Used to mint the 128-bit unique IDs inside fresh capability tokens — two RDRAND calls per token, ~30 ns total." },
      { szTitle: "Speculation barrier on the validate path", szBody: "lfence is inserted after capability validation to prevent speculative execution from leaking permission bits via cache side-channels (Spectre-class attacks). One instruction. ~1 ns." },
    ],
  },
  {
    szId: "M-02", iLayer: 2, szName: "Isolation", szStatus: "built",
    szShort: "Linux namespaces + tmpfs sandbox + pivot_root.",
    szPlain: "Locks a process inside its own private view of the system: own user IDs, own process tree, own filesystem. The sandbox literally cannot see the rest of your machine.",
    vDepends: ["M-01", "M-21"], vUsedBy: ["M-22-planned"],
    szRole: "Hooks into M-01's PRE_SPAWN chain — runs before the process starts.",
    vScenarios: [
      { szTitle: "Build a USER namespace", szBody: "unshare(CLONE_NEWUSER) creates a fresh user namespace. Then we write '0 1000 1' into /proc/self/uid_map: inside the sandbox the process is uid 0 (root), outside it's still uid 1000 (the host user). That tiny mapping is what makes user-namespace sandboxing possible without root." },
      { szTitle: "Build a PID namespace + fork twice", szBody: "unshare(CLONE_NEWPID) takes effect on the NEXT fork — not the calling process. So we fork; the child sees itself as PID 1 inside the new namespace and as some host PID outside. From inside, kill(1, SIGKILL) wakes init, which is the process itself, sandboxing the entire process tree." },
      { szTitle: "Build a MOUNT namespace + pivot_root", szBody: "Three steps: unshare(CLONE_NEWNS), then mount(NULL, '/', NULL, MS_REC|MS_PRIVATE, NULL) so subsequent mounts don't leak back, then build a tmpfs at /tmp/astra_sandbox/<pid>, bind-mount /usr/lib read-only, pivot_root, and umount2 the old root with MNT_DETACH. From now on the process sees only the sandbox tree." },
      { szTitle: "Pick a sandbox profile", szBody: "ProfileEngine ships five profiles: PARANOID (all 5 namespaces + seccomp ENFORCE + 256 MiB RAM cap), STRICT, STANDARD, RELAXED, CUSTOM. Each spawn call picks one. Profiles are sealed after Engine::init — you can't mutate PARANOID at runtime to weaken it." },
    ],
  },
  {
    szId: "M-03", iLayer: 2, szName: "IPC Engine", szStatus: "built",
    szShort: "memfd-backed zero-copy ring buffer with futex wait/notify.",
    szPlain: "Lets two sandboxes talk to each other at memory-bus speed without copying any data. Every message is gated by a capability check — no token, no message.",
    vDepends: ["M-01"], vUsedBy: ["M-22-planned", "M-23-planned"],
    szRole: "The flagship feature. Sub-microsecond validated message delivery.",
    vScenarios: [
      { szTitle: "Allocate a shared channel", szBody: "ChannelFactory::createChannel(2 MiB) calls memfd_create — gets a file descriptor backed by RAM, not disk. Then ftruncate to 2 MiB, then mmap(MAP_SHARED). Both ends of the channel mmap the same fd; both see the same physical pages. Cost: one syscall up front, then zero per message." },
      { szTitle: "Wait-free send on the small-message path", szBody: "For payloads ≤ 256 B, the producer pre-checks free space, then issues a single fetch_add on write_claim_index — one atomic, no spin loop. Wait-free. If two producers race and both succeed the pre-check, the second one's post-check fails and it writes a SKIP sentinel that the reader silently consumes." },
      { szTitle: "Lock-free send on the large-message path", szBody: "For payloads > 256 B, fetch_add is too aggressive — overcommitting wastes bytes you can't reclaim. The large path uses a CAS loop: re-read claim, re-read free space, only CAS if it definitely fits. Bounded retries; no SKIP records." },
      { szTitle: "Block until a message arrives", szBody: "readWait() loads write_index. If equal to read_index, the ring is empty — call atomic.wait(write_index, current). Linux maps that to a futex SYS_FUTEX_WAIT. Reader sleeps with zero CPU. Writer's commit calls notify_one which wakes the kernel's futex queue. Latency: ~1 µs from notify to runnable." },
      { szTitle: "Capability gate every message (planned)", szBody: "Planned for the next sprint, central to Paper 1: every send will require a CapToken parameter and call validate(token, IPC_SEND); every recv calls validate(token, IPC_RECV). Today's RingBuffer.cpp does not yet take a token, so this gate is pending wiring. The capability infrastructure (M-01 token pool, derive, revoke, IPC permission bits) is already built — only the M-03 integration is missing." },
    ],
  },
  {
    szId: "M-06", iLayer: 2, szName: "Allocator", szStatus: "built",
    szShort: "4-tier pool routing + poison patterns + capability-gated.",
    szPlain: "A hardened malloc. Every allocation has to present a capability with the MEM_ALLOC permission, every freed block is poisoned to detect later misuse, and per-module quotas stop a runaway component from eating all memory.",
    vDepends: ["M-01"], vUsedBy: [],
    szRole: "Audit events flow into M-09 telemetry.",
    vScenarios: [
      { szTitle: "Tiered routing", szBody: "Request 4 KB → small pool. Request 64 KB → medium pool. Request 4 MB → large pool. Anything above 16 MB → mmap directly. Each pool is a fixed-size slab allocator, so allocation is O(1) — pop from a freelist, no searching." },
      { szTitle: "Capability + quota check before any pool work", szBody: "allocateFor(ModuleId::IPC, 4096, capToken) does three checks in order: (1) M-01.validate(token, MEM_ALLOC), (2) QuotaManager.tryReserve(IPC, 4096) — has the IPC module already used its 64 MiB hourly budget? (3) Pool fetch. Reject early on any failure with a specific ErrorCode and an audit event." },
      { szTitle: "Detect double-free with poison patterns", szBody: "Every freed block is overwritten with 0xDEADBEEF. On the next allocation that pulls from the same slab, we check the poison pattern is intact. If a use-after-free wrote to the freed block in the meantime, the pattern is corrupt and we fail the alloc + emit a CORRUPTION audit event." },
      { szTitle: "Audit pipeline", szBody: "Every alloc, free, capability rejection, quota rejection, and double-free emits an AuditEvent. M-09 eBPF subscribes to that stream. Year-2 work feeds it into the M-08 AI subsystem to learn allocation patterns and detect anomalies." },
    ],
  },
  {
    szId: "M-09", iLayer: 2, szName: "eBPF Observability", szStatus: "built",
    szShort: "libbpf probe loader + epoll-based ring-buffer poller.",
    szPlain: "Loads small kernel-side eBPF programs that watch interesting events (process spawns, capability changes) and streams them up to userspace. Almost-free observability.",
    vDepends: ["M-01"], vUsedBy: [],
    szRole: "Hooks into M-01's process / service / capability event callbacks.",
    vScenarios: [
      { szTitle: "Load the probes at startup", szBody: "ProbeManager scans the probe directory for .bpf.o files, calls bpf_object__open + bpf_object__load via libbpf to ship them into the kernel, and attaches each to its USDT or tracepoint target. One probe shipping today (task_spawn); TASK_EXIT and SERVICE_EVENT are reserved." },
      { szTitle: "Drain the kernel ring buffer", szBody: "RingBufferPoller starts a thread that epoll_waits on the BPF map's epoll fd. When the kernel writes events, the wait returns; we call ring_buffer__consume to drain everything pending and dispatch each to a user callback. epoll means zero CPU when nothing is happening." },
      { szTitle: "Capture every process spawn", szBody: "M-01's ProcessManager calls setProcessEventCallback at startup, pointing at M-09's emitter. On every spawn, M-09 fires an USDT tracepoint that the kernel-side task_spawn.bpf.c probe captures into the ring buffer. Userspace reads it back microseconds later." },
      { szTitle: "Bridge AuditEvents into the same stream", szBody: "M-06 (allocator) and M-22 (AgentGuard, planned) both emit AuditEvents. M-09 subscribes to those callbacks too, so the same telemetry pipeline carries process events, capability events, allocation events, and security events. One sink, structured records." },
    ],
  },

  // ===== RESERVED =====
  { szId: "M-04", iLayer: 3, szName: "Checkpoint", szStatus: "reserved",
    szShort: "CRIU-style snapshots without kernel patches.",
    szPlain: "Reserved. Will be able to freeze a running process to disk and restart it later, useful for forensics and migration.",
    vDepends: ["M-01", "M-05"], vUsedBy: [], szRole: "Phase 5.",
    vScenarios: [
      { szTitle: "Planned: snapshot a running process", szBody: "Walk /proc/<pid>/maps to enumerate VMAs, ptrace-stop the process, dump register state, copy each VMA's pages to a checkpoint file, capture open fds via /proc/<pid>/fd. The hard part is restoring without kernel help — recreating the address space layout and file descriptors deterministically." },
      { szTitle: "Planned: incremental checkpoints", szBody: "Use userfaultfd to track which pages have been written since the last checkpoint. Each checkpoint after the first is a delta — only modified pages — so periodic snapshotting (e.g., every 100 ms during an AgentGuard agent run) doesn't kill throughput." },
    ],
  },
  { szId: "M-05", iLayer: 3, szName: "Replay", szStatus: "reserved",
    szShort: "Deterministic byte-for-byte replay.",
    szPlain: "Reserved. Plays a checkpoint back exactly, including signal delivery and scheduling, so a security incident can be re-run in slow motion.",
    vDepends: ["M-04"], vUsedBy: ["M-22-planned"], szRole: "Phase 5. Critical path for AgentGuard.",
    vScenarios: [
      { szTitle: "Planned: replay an AgentGuard session", szBody: "An AI agent's tool-call session is recorded by M-22. To debug an exploit, replay starts from a checkpoint and feeds the recorded syscall results, IPC messages, and signal deliveries back in the same order. Result: byte-for-byte determinism." },
      { szTitle: "Planned: time dilation for forensics", szBody: "Couples with M-19 (Virtual Time). The replayed process sees a logical clock the analyst can pause, rewind, or step. Useful for finding the exact instruction where a memory corruption first occurs." },
    ],
  },
  { szId: "M-12", iLayer: 3, szName: "Verify", szStatus: "reserved",
    szShort: "Formal-verification harness.",
    szPlain: "Reserved. The single CBMC proof of capability monotonicity ships with Paper 1; broader verification work is later.",
    vDepends: ["M-01"], vUsedBy: [], szRole: "Phase 9.",
    vScenarios: [
      { szTitle: "Planned: capability monotonicity proof (Paper 1)", szBody: "CBMC bounded model check that for any sequence of derive() calls, child.permissions ⊆ parent.permissions always holds. This single property — that derivation can never escalate — is what makes the whole capability story safe. ~50 lines of CBMC harness." },
      { szTitle: "Planned: ringbuffer no-reorder TLA+ spec", szBody: "TLA+ model of M-03's two-phase claim/commit protocol proving that messages are delivered in the order their commit completed, regardless of how many producers race. Used in Paper 1 as the formal backing for the latency benchmarks." },
    ],
  },
  { szId: "M-08", iLayer: 4, szName: "AI Scheduler", szStatus: "reserved",
    szShort: "Anomaly detection + learned allocator.",
    szPlain: "Reserved. The narrow year-1 slice is a learned size-class predictor for the allocator (a 4-week side project), not the broad anomaly-detection vision.",
    vDepends: ["M-09", "M-06"], vUsedBy: [], szRole: "Phase 6.",
    vScenarios: [
      { szTitle: "Planned: learned size-class predictor", szBody: "Trained on real allocation traces from a running Astra workload. Given a caller-id + recent size histogram, a CART or 2-layer MLP (under 100 KB) predicts the optimal pool tier. Compared in Paper 2 against snmalloc's static heuristics." },
      { szTitle: "Planned: behavioural anomaly detector", szBody: "Subscribes to M-09's audit stream. Builds a baseline of each service's syscall-pattern fingerprint over time. Sudden drift triggers SECURITY_ALERT — which feeds the revocation-cascade scenario shown above." },
    ],
  },
  { szId: "M-16", iLayer: 4, szName: "HAL", szStatus: "reserved",
    szShort: "Hardware abstraction layer.",
    szPlain: "Reserved. CPU feature detection, PMU access. Phase 3.",
    vDepends: ["M-01"], vUsedBy: [], szRole: "Phase 3.",
    vScenarios: [
      { szTitle: "Planned: probe CPU features at boot", szBody: "Issue CPUID, parse the result, expose to the rest of the runtime: 'do we have RDRAND? AVX-512? AES-NI? Intel LAM? ARM MTE?'. M-21's NASM ports pick optimised paths based on these flags. The PQC ML-KEM implementation needs AVX2 to hit its <200 ns validate-path target." },
      { szTitle: "Planned: PMU counters for the latency harness", szBody: "Read the timestamp counter (RDTSC) directly, with rdtscp + lfence around it for ordering. The latency benchmark in Paper 1 uses this to produce HDR histograms with single-cycle resolution." },
    ],
  },
  { szId: "M-17", iLayer: 4, szName: "Profiler", szStatus: "reserved",
    szShort: "Statistical profiling with M-08 feedback.",
    szPlain: "Reserved. The narrower year-1 piece (RDTSC histograms + CBMC + TLA+ ringbuffer spec) ships alongside Paper 1.",
    vDepends: ["M-09"], vUsedBy: [], szRole: "Phase 6.",
    vScenarios: [
      { szTitle: "Planned: HDR histogram of every IPC round-trip", szBody: "Wraps every M-03 send/recv with rdtsc; emits to a HDR-style histogram every 10k operations. CI gate: the p99.99 latency must not regress more than 5% per commit. This data is the headline figure of Paper 1." },
      { szTitle: "Planned: SCHED_DEADLINE integration", szBody: "M-02's REALTIME profile wires the spawned process into Linux's SCHED_DEADLINE class via sched_setattr. The profiler verifies that worst-case wake-up latency stays below the configured deadline. Useful for AgentGuard agents with hard tail-latency budgets." },
    ],
  },
  { szId: "M-07", iLayer: 5, szName: "Job Engine", szStatus: "reserved",
    szShort: "cgroup-backed job scheduling.",
    szPlain: "Reserved.",
    vDepends: ["M-01", "M-02"], vUsedBy: [], szRole: "Phase 3.",
    vScenarios: [
      { szTitle: "Planned: bounded job execution", szBody: "Wrap a sandboxed process in a cgroup v2 subgroup with memory + CPU + PID limits. The job engine handles backpressure when limits hit, restarts on policy, and reports outcome via EventBus." },
      { szTitle: "Planned: dependency-aware DAG scheduler", szBody: "Specify jobs with input/output deps (capability tokens, IPC channel handles). The engine topo-sorts and dispatches them. A failed parent revokes child tokens — same cascade primitive used everywhere else in Astra." },
    ],
  },
  { szId: "M-10", iLayer: 5, szName: "WASM", szStatus: "reserved",
    szShort: "wasmtime-based WASM sandbox.",
    szPlain: "Reserved. Deferred to year 2 because the WASI Preview 3 spec is still moving.",
    vDepends: ["M-01", "M-02"], vUsedBy: [], szRole: "Phase 4.",
    vScenarios: [
      { szTitle: "Planned: WASM module as a typed component", szBody: "WIT-typed component instantiated inside an Astra process. Capability tokens map cleanly onto WASI handle types — both are 'unforgeable references to a resource you're allowed to use'. So a token granting FS_READ on /var/log gives the WASM module exactly that handle, nothing else." },
      { szTitle: "Planned: hot-swap a service", szBody: "Re-instantiate a component with state migrated through the existing serialise → IPC → deserialise pattern. Useful for rolling out a security patch to a running runtime without restarting it." },
    ],
  },
  { szId: "M-11", iLayer: 5, szName: "AQL", szStatus: "reserved",
    szShort: "Astra Query Language.",
    szPlain: "Reserved. Runtime introspection query language.",
    vDepends: ["M-01"], vUsedBy: [], szRole: "Phase 4.",
    vScenarios: [
      { szTitle: "Planned: live introspection of the runtime", szBody: "SELECT * FROM services WHERE state='RUNNING'. SELECT name, runtime_us FROM hooks WHERE point='PRE_SPAWN' ORDER BY runtime_us DESC. Each query is gated by a capability — only an admin token can introspect security state." },
      { szTitle: "Planned: live forensics during incident", szBody: "When M-09 fires SECURITY_ALERT, the on-call analyst runs ad-hoc queries against the live runtime — capability tree, IPC channel state, recent allocations — without restarting anything." },
    ],
  },
  { szId: "M-15", iLayer: 5, szName: "Consensus", szStatus: "reserved",
    szShort: "Raft for distributed Astra clusters.",
    szPlain: "Reserved.",
    vDepends: ["M-01"], vUsedBy: [], szRole: "Phase 8.",
    vScenarios: [
      { szTitle: "Planned: distributed capability delegation", szBody: "Capability tokens that span multiple Astra hosts. A token issued on node A can be presented to node B; both nodes consult a Raft-replicated revocation log so revocation cascades cluster-wide in bounded time." },
    ],
  },
  { szId: "M-13", iLayer: 6, szName: "Network", szStatus: "reserved",
    szShort: "Capability-gated socket API.",
    szPlain: "Reserved.",
    vDepends: ["M-01"], vUsedBy: [], szRole: "Phase 7.",
    vScenarios: [
      { szTitle: "Planned: capability-gated socket()", szBody: "Network NS gives the sandbox its own routing table + virtual NIC. Every socket() call validates NET_CONNECT or NET_LISTEN. The capability can scope allowed destinations: token may say 'connect to 10.0.0.0/8 only', enforced at socket-create time." },
      { szTitle: "Planned: built-in egress firewall", szBody: "Outbound connections traverse a stateful filter. AgentGuard agents (M-22) use this to whitelist allowed domains for an LLM agent's tool calls." },
    ],
  },
  { szId: "M-14", iLayer: 6, szName: "VFS", szStatus: "reserved",
    szShort: "Pluggable virtual filesystem.",
    szPlain: "Reserved.",
    vDepends: ["M-01"], vUsedBy: [], szRole: "Phase 7.",
    vScenarios: [
      { szTitle: "Planned: capability ACLs at the inode level", szBody: "Every open() validates against a capability that names the path prefix and the access mode. Read-only token on /etc cannot open() anything for write. Enforced in user-space VFS, before the syscall ever reaches the kernel." },
    ],
  },
  { szId: "M-18", iLayer: 6, szName: "Crypto", szStatus: "reserved",
    szShort: "Ed25519 + HMAC + post-quantum hybrid.",
    szPlain: "Reserved. Year-2 work adds ML-DSA / ML-KEM hybrids on top of Ed25519 for capability tokens that survive a future quantum attacker.",
    vDepends: ["M-21"], vUsedBy: [], szRole: "Phase 7.",
    vScenarios: [
      { szTitle: "Planned: hybrid PQC capability signing (Paper 5)", szBody: "Capability tokens persisted to disk (M-04 checkpoints) get a hybrid signature: Ed25519 + ML-DSA-65 (FIPS 204). Both must verify. If quantum breaks Ed25519 in the 2030s, ML-DSA still holds — and CNSA 2.0 mandates this for national-security workloads by 2027." },
      { szTitle: "Planned: hybrid PQC channel handshake", szBody: "First message on a fresh M-03 channel does X25519 + ML-KEM-768 (FIPS 203) hybrid key agreement. The shared secret HMACs subsequent messages. Adds ~500 ns per channel setup; zero per-message cost after." },
    ],
  },
  { szId: "M-19", iLayer: 6, szName: "Virtual Time", szStatus: "reserved",
    szShort: "Deterministic clocks for replay.",
    szPlain: "Reserved.",
    vDepends: ["M-01"], vUsedBy: ["M-05"], szRole: "Phase 5.",
    vScenarios: [
      { szTitle: "Planned: per-process logical clock", szBody: "clock_gettime() inside a sandboxed process returns a monotonic logical clock the runtime controls. Pause it, rewind it, accelerate it. Required for byte-for-byte deterministic replay (M-05) — wall-clock-dependent code becomes reproducible." },
    ],
  },
  { szId: "M-20", iLayer: 6, szName: "Module Loader", szStatus: "reserved",
    szShort: "Signed dynamic module loading.",
    szPlain: "Reserved. Switches to PQC hybrid signatures once M-18 ships them.",
    vDepends: ["M-01", "M-18"], vUsedBy: [], szRole: "Phase 8.",
    vScenarios: [
      { szTitle: "Planned: load a signed module at runtime", szBody: "Module manifest carries an Ed25519 + ML-DSA hybrid signature. Loader verifies both, inspects the ELF for stack canaries / RELRO / NX, refuses unsigned or unhardened binaries — those checks are non-bypassable, even for the runtime owner." },
      { szTitle: "Planned: hot-load a security patch", szBody: "Drop a new signed .so into the modules dir; the loader sees it via inotify, validates, swaps it into the running runtime via M-10's hot-swap path. No restart, no downtime." },
    ],
  },
];

const SPAWN_STEPS = [
  {
    iIdx: 1, szTitle: "1. Caller asks for a sandbox",
    szBody: "Any module can call `runtime.processes().spawn(config)`. The caller must hold a capability token with the PROC_SPAWN permission — without it, the call fails immediately.",
    szLeft: "Caller", szRight: "M-01 ProcessManager", szArrow: "spawn(config)",
  },
  {
    iIdx: 2, szTitle: "2. Capability check",
    szBody: "ProcessManager validates the capability token against M-01's CapabilityManager. The check is lock-free — it just compares the token's epoch and permission bits — and returns in tens of nanoseconds.",
    szLeft: "M-01 ProcessManager", szRight: "M-01 CapabilityManager", szArrow: "validate(token, PROC_SPAWN)",
  },
  {
    iIdx: 3, szTitle: "3. PRE_SPAWN hooks fire",
    szBody: "ProcessManager walks the PRE_SPAWN chain in priority order. M-02's IsolationService registered a hook at startup, so its `applyIsolation` callback runs here.",
    szLeft: "M-01 ProcessManager", szRight: "M-01 HookRegistry", szArrow: "execute(PRE_SPAWN)",
  },
  {
    iIdx: 4, szTitle: "4. Namespaces + sandbox built",
    szBody: "M-02 calls `unshare(CLONE_NEWUSER | CLONE_NEWPID | CLONE_NEWNS)`, makes the mount tree private, builds a tmpfs at /tmp/astra_sandbox/<pid>, bind-mounts /usr/lib read-only, then `pivot_root` swaps the process into its new world.",
    szLeft: "M-02 IsolationService", szRight: "M-02 NamespaceManager", szArrow: "setup(profile, uid, gid)",
  },
  {
    iIdx: 5, szTitle: "5. fork + exec",
    szBody: "ProcessManager forks the child, which inherits the namespace setup. The child execs the requested binary. By the time it runs, it can't see /etc, /home, or anything outside the sandbox.",
    szLeft: "M-01 ProcessManager", szRight: "kernel", szArrow: "fork() + exec()",
  },
  {
    iIdx: 6, szTitle: "6. Event published",
    szBody: "ProcessManager publishes a PROCESS_SPAWNED event on the EventBus. M-09 eBPF, listening on that callback, emits a tracepoint to its kernel ring buffer for observability.",
    szLeft: "M-01 EventBus", szRight: "M-09 eBPF", szArrow: "PROCESS_SPAWNED",
  },
];

const COMPARISON = [
  { szFeature: "Userspace (no kernel patch needed)", vMark: ["yes", "yes", "yes", "yes", "no"] },
  { szFeature: "Capability-based access control", vMark: ["partial", "no", "no", "no", "yes"] },
  { szFeature: "Zero-copy IPC for sandboxed processes", vMark: ["yes", "no", "no", "via-vsock", "via-svc"] },
  { szFeature: "O(1) cascading capability revocation", vMark: ["yes", "no", "no", "no", "kernel"] },
  { szFeature: "Runs unmodified Linux binaries", vMark: ["yes", "yes", "yes", "yes", "no"] },
  { szFeature: "Hardware-virt isolation", vMark: ["no", "no", "partial", "yes", "no"] },
  { szFeature: "Formally verified core", vMark: ["partial", "no", "no", "no", "yes"] },
  { szFeature: "Built for AI agent sandboxing", vMark: ["partial", "no", "no", "no", "no"] },
];
const COMPARISON_HEADERS = ["Astra", "Docker", "gVisor", "Firecracker", "seL4"];

const ROADMAP = [
  { szWhen: "Now", szTitle: "Track A — pitch refresh", szBody: "README + docs honesty pass. Empty-pillar claims removed from headline, 5-paper portfolio committed.", szColor: CLR.szGreen },
  { szWhen: "Months 1-4", szTitle: "Paper 1 — flagship", szBody: "M-21 NASM ports + CBMC monotonicity proof + RDTSC harness + macrobench. Submit to USENIX ATC 2027 (January).", szColor: CLR.szRed },
  { szWhen: "Months 4-6", szTitle: "Real-time verification harness", szBody: "TLA+ spec for the ring buffer, HDR latency histograms, CI gate on regression.", szColor: CLR.szAmber },
  { szWhen: "Months 4-8", szTitle: "Paper 2 — hardware-tagged caps", szBody: "Intel LAM / ARM MTE tags stored inside capability tokens. Target: OSDI 2027.", szColor: CLR.szAmber },
  { szWhen: "Months 6-10", szTitle: "Paper 4 — TEE attestation", szBody: "Move capability token pool into Intel TDX memory. Attestation-backed derive(). Target: ASPLOS 2027.", szColor: CLR.szAmber },
  { szWhen: "Months 6-9", szTitle: "Paper 5 — post-quantum hybrid", szBody: "ML-DSA + ML-KEM hybrid signatures and KEM. Target: CCS 2027.", szColor: CLR.szAmber },
  { szWhen: "Months 8-12", szTitle: "Paper 3 — AI agent sandboxing", szBody: "M-22 AgentGuard: tool-call broker, prompt-data taint, replay-backed forensic debugging. Target: USENIX Security 2027.", szColor: CLR.szRed },
];

// ---- helpers --------------------------------------------------------------

function useOnScreen() {
  const refEl = useRef(null);
  const [bVisible, setVisible] = useState(false);
  useEffect(() => {
    const lEl = refEl.current;
    if (!lEl) return;
    const lObs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); lObs.disconnect(); } }, { threshold: 0.12 });
    lObs.observe(lEl);
    return () => lObs.disconnect();
  }, []);
  return [refEl, bVisible];
}

// ---- Viewport hook for responsive layouts -----------------------------
function useViewport() {
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const fn = () => setVw(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return {
    vw,
    bMobile: vw < 768,
    bTablet: vw >= 768 && vw < 1024,
    bDesktop: vw >= 1024,
  };
}

function Reveal({ children, iDelay = 0, style = {} }) {
  const [ref, vis] = useOnScreen();
  return (
    <div ref={ref} style={{ ...style, opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(28px)", transition: `opacity .8s ease ${iDelay}ms, transform .8s ease ${iDelay}ms` }}>
      {children}
    </div>
  );
}

const sxSectionPadding = (bMobile) => ({
  padding: bMobile ? "60px 16px" : "100px 24px",
  maxWidth: "1200px",
  margin: "0 auto",
});
const SX_SECTION_PADDING = sxSectionPadding(false); // legacy; prefer sxSectionPadding(bMobile)
const SX_LABEL = { fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szRed, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "20px" };
const SX_H2 = { fontFamily: "'Geist', system-ui, sans-serif", fontSize: "clamp(24px, 4.5vw, 44px)", color: CLR.szTextPrimary, fontWeight: 600, letterSpacing: "-0.5px", marginBottom: "18px", lineHeight: 1.15 };
const SX_LEAD = { fontFamily: "'Geist', system-ui, sans-serif", fontSize: "clamp(15px, 2vw, 17px)", color: CLR.szTextSecondary, lineHeight: 1.7, maxWidth: "780px", marginBottom: "40px" };

// ---- HERO -----------------------------------------------------------------

function AstraHero() {
  const { bMobile } = useViewport();
  return (
    <section style={{ ...sxSectionPadding(bMobile), paddingTop: bMobile ? "100px" : "150px", paddingBottom: bMobile ? "40px" : "60px" }}>
      <Reveal>
        <div style={SX_LABEL}>flagship project · KernelArch Labs</div>
      </Reveal>
      <Reveal iDelay={120}>
        <h1 style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "clamp(28px, 6vw, 72px)", lineHeight: 1.1, fontWeight: 600, letterSpacing: "-1px", color: CLR.szTextPrimary, marginBottom: "24px", maxWidth: "1000px" }}>
          A userspace runtime that gates every <span style={{ color: CLR.szRed }}>shared-memory message</span> with an unforgeable capability token.
        </h1>
      </Reveal>
      <Reveal iDelay={240}>
        <p style={{ ...SX_LEAD, fontSize: "clamp(16px, 2.2vw, 20px)", maxWidth: "880px" }}>
          Astra is a 21-module supervisor that runs above stock Linux. It hands every sandboxed process its own private view of the world, lets two sandboxes talk to each other at memory-bus speed, and revokes every permission they hold the moment something looks wrong — all without a kernel patch.
        </p>
      </Reveal>
      <Reveal iDelay={360}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "20px" }}>
          <a href="#astra-architecture" style={{ ...sxBtnPrimary }}>Explore the architecture</a>
          <a href="#astra-flow" style={{ ...sxBtnGhost }}>How a process is spawned</a>
          <a href="https://github.com/KernelArch-Lab/Astra" target="_blank" rel="noreferrer" style={{ ...sxBtnGhost }}>GitHub →</a>
        </div>
      </Reveal>
      <Reveal iDelay={480}>
        <div style={{ marginTop: bMobile ? "40px" : "70px", display: "grid", gridTemplateColumns: bMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(170px, 1fr))", gap: "1px", backgroundColor: CLR.szBorder, border: `1px solid ${CLR.szBorder}` }}>
          {[
            { szLabel: "Modules total", szValue: "21" },
            { szLabel: "Built today", szValue: "6" },
            { szLabel: "Lines of C++", szValue: "~14k" },
            { szLabel: "CTest targets", szValue: "13" },
            { szLabel: "Papers planned", szValue: "5" },
            { szLabel: "First submission", szValue: "ATC '27" },
          ].map((s) => (
            <div key={s.szLabel} style={{ padding: "26px 20px", backgroundColor: CLR.szCard }}>
              <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "1.5px", textTransform: "uppercase" }}>{s.szLabel}</div>
              <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "30px", color: CLR.szTextPrimary, fontWeight: 600, marginTop: "8px" }}>{s.szValue}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

const sxBtnPrimary = { fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "12px", padding: "13px 26px", backgroundColor: CLR.szRed, color: "#fff", border: "none", borderRadius: "3px", cursor: "pointer", letterSpacing: "0.5px", textDecoration: "none", display: "inline-block" };
const sxBtnGhost = { fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "12px", padding: "12px 26px", backgroundColor: "transparent", color: CLR.szTextSecondary, border: `1px solid ${CLR.szBorder}`, borderRadius: "3px", cursor: "pointer", letterSpacing: "0.5px", textDecoration: "none", display: "inline-block" };

// ---- THE PROBLEM ----------------------------------------------------------

function AstraProblem() {
  const { bMobile } = useViewport();
  const COL_BAD = "#f3e8e6";
  const COL_GOOD = "#e6f3eb";
  return (
    <section id="astra-problem" style={{ ...sxSectionPadding(bMobile), paddingTop: bMobile ? "40px" : "60px" }}>
      <Reveal>
        <div style={SX_LABEL}>the problem</div>
        <h2 style={SX_H2}>The world runs untrusted code now.</h2>
        <p style={SX_LEAD}>
          Containers leak. AI agents can read files they shouldn't. A compromised library can talk to anything. The defences we have today were designed for trusted programs that misbehave by accident — not for adversarial code that's actively trying to escape.
        </p>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", marginTop: "40px" }}>
        {[
          { szTitle: "Docker / containers", szBody: "Share the host kernel. One kernel bug = full escape. Capabilities are coarse and ambient — `CAP_SYS_ADMIN` is basically root.", bBad: true },
          { szTitle: "seL4 microkernel", szBody: "Beautifully verified, capability-based. But it IS the kernel — you can't run a regular Linux binary against it.", bBad: true, szTone: "mixed" },
          { szTitle: "gVisor", szBody: "Userspace syscall emulation. No capabilities, no zero-copy IPC, every syscall takes a Go-runtime trip.", bBad: true },
          { szTitle: "Firecracker microVMs", szBody: "Hardware-virt isolation, fast boot, but no capability model and no efficient inter-VM IPC. Designed for serverless, not interactive sandboxing.", bBad: true },
        ].map((c) => (
          <Reveal key={c.szTitle}>
            <div style={{ padding: "26px", border: `1px solid ${CLR.szBorder}`, backgroundColor: c.szTone === "mixed" ? CLR.szCard : COL_BAD, borderRadius: "4px", height: "100%" }}>
              <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: c.szTone === "mixed" ? CLR.szAmber : CLR.szRed, letterSpacing: "1.5px", marginBottom: "10px" }}>EXISTING APPROACH</div>
              <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "20px", fontWeight: 600, color: CLR.szTextPrimary, marginBottom: "10px" }}>{c.szTitle}</div>
              <div style={{ fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.6 }}>{c.szBody}</div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal iDelay={200}>
        <div style={{ marginTop: "40px", padding: "32px", backgroundColor: COL_GOOD, border: `1px solid ${CLR.szGreen}`, borderRadius: "4px" }}>
          <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szGreen, letterSpacing: "1.5px", marginBottom: "10px" }}>ASTRA'S BET</div>
          <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "22px", fontWeight: 600, color: CLR.szTextPrimary, marginBottom: "10px", lineHeight: 1.3 }}>
            What if every operation — spawn, alloc, send, receive — had to present a token first, and revoking that token cascaded to every child token in O(1)?
          </div>
          <div style={{ fontSize: "15px", color: CLR.szTextSecondary, lineHeight: 1.6 }}>
            That's the runtime above. No kernel patch. Runs your existing Linux binaries. Talks to the kernel through namespaces, seccomp, eBPF and io_uring like everyone else — but every call is gated by a capability check that takes tens of nanoseconds.
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ---- LAYER + MODULE EXPLORER ---------------------------------------------

function AstraLayerExplorer() {
  const { bMobile } = useViewport();
  const [iSelectedLayer, setLayer] = useState(2);   // start on Services (the built layer)
  const [szSelectedModule, setModule] = useState("M-03");

  const aLayer = LAYERS[iSelectedLayer - 1];
  const vLayerModules = MODULES.filter((m) => m.iLayer === iSelectedLayer);
  const aModule = MODULES.find((m) => m.szId === szSelectedModule) || vLayerModules[0];

  return (
    <section id="astra-architecture" style={{ ...sxSectionPadding(bMobile) }}>
      <Reveal>
        <div style={SX_LABEL}>interactive · 6 layers · 21 modules</div>
        <h2 style={SX_H2}>Tap a layer. Tap a module. See exactly what it does.</h2>
        <p style={SX_LEAD}>
          Astra is split into 6 layers and 21 numbered modules. Six are built and tested today; fifteen are reserved scaffolding. The colour bar on each module tells you which is which.
        </p>
      </Reveal>

      {/* Layer ribbon */}
      <div style={{ display: "grid", gridTemplateColumns: bMobile ? "repeat(3, 1fr)" : "repeat(6, 1fr)", gap: "8px", marginBottom: "32px", marginTop: "20px" }}>
        {LAYERS.map((l) => {
          const bActive = l.iId === iSelectedLayer;
          return (
            <button key={l.iId} onClick={() => { setLayer(l.iId); setModule(MODULES.find((m) => m.iLayer === l.iId).szId); }}
              style={{ cursor: "pointer", textAlign: "left", padding: "16px 14px", border: `1px solid ${bActive ? CLR.szRed : CLR.szBorder}`, backgroundColor: bActive ? CLR.szRed : CLR.szCard, color: bActive ? "#fff" : CLR.szTextPrimary, borderRadius: "4px", transition: "all .2s" }}>
              <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: bActive ? "rgba(255,255,255,0.7)" : CLR.szTextDim, letterSpacing: "1.5px" }}>L{l.iId}</div>
              <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "15px", fontWeight: 600, marginTop: "4px" }}>{l.szName}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: bMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1.6fr)", gap: bMobile ? "16px" : "24px" }}>
        {/* Left: layer summary + modules in this layer */}
        <div style={{ padding: bMobile ? "20px" : "28px", backgroundColor: CLR.szCard, border: `1px solid ${CLR.szBorder}`, borderRadius: "4px", height: "fit-content" }}>
          <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szRed, letterSpacing: "1.5px" }}>LAYER {aLayer.iId}</div>
          <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "26px", fontWeight: 600, color: CLR.szTextPrimary, marginTop: "4px" }}>{aLayer.szName}</div>
          <div style={{ fontSize: "14px", color: CLR.szTextSecondary, marginTop: "4px", fontStyle: "italic" }}>{aLayer.szTagline}</div>
          <div style={{ fontSize: "14px", color: CLR.szTextSecondary, marginTop: "16px", lineHeight: 1.6 }}>{aLayer.szPlain}</div>
          <div style={{ marginTop: "24px", borderTop: `1px solid ${CLR.szBorder}`, paddingTop: "16px" }}>
            <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "1.5px", marginBottom: "12px" }}>MODULES IN THIS LAYER</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {vLayerModules.map((m) => {
                const bSelected = m.szId === aModule.szId;
                const bBuilt = m.szStatus === "built";
                return (
                  <button key={m.szId} onClick={() => setModule(m.szId)}
                    style={{ cursor: "pointer", textAlign: "left", padding: "10px 12px", border: `1px solid ${bSelected ? CLR.szTextPrimary : CLR.szBorder}`, backgroundColor: bSelected ? CLR.szTextPrimary : CLR.szCard, color: bSelected ? "#fff" : CLR.szTextPrimary, borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all .15s" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: bBuilt ? CLR.szGreen : CLR.szTextDim }} />
                      <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.5px" }}>{m.szId}</span>
                      <span style={{ fontSize: "13px" }}>{m.szName}</span>
                    </span>
                    <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: bSelected ? "rgba(255,255,255,0.6)" : CLR.szTextDim, textTransform: "uppercase", letterSpacing: "1px" }}>{m.szStatus}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: module detail */}
        <div style={{ padding: bMobile ? "20px" : "32px", backgroundColor: CLR.szCard, border: `1px solid ${CLR.szBorder}`, borderRadius: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szRed, letterSpacing: "1.5px" }}>{aModule.szId}</div>
              <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "32px", fontWeight: 600, color: CLR.szTextPrimary, marginTop: "4px" }}>{aModule.szName}</div>
            </div>
            <div style={{ padding: "6px 12px", backgroundColor: aModule.szStatus === "built" ? CLR.szGreen : CLR.szSurface, color: aModule.szStatus === "built" ? "#fff" : CLR.szTextSecondary, borderRadius: "3px", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", height: "fit-content" }}>
              {aModule.szStatus === "built" ? "BUILT" : "RESERVED"}
            </div>
          </div>
          <div style={{ fontSize: "16px", color: CLR.szTextSecondary, marginTop: "20px", lineHeight: 1.5, fontWeight: 500 }}>{aModule.szShort}</div>
          <div style={{ fontSize: "15px", color: CLR.szTextSecondary, marginTop: "16px", lineHeight: 1.7 }}>{aModule.szPlain}</div>
          <div style={{ marginTop: "24px", padding: "16px", backgroundColor: CLR.szSurface, borderRadius: "3px", fontSize: "13px", color: CLR.szTextSecondary, lineHeight: 1.5 }}>
            <span style={{ color: CLR.szRed, fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "1.5px" }}>ROLE</span>
            <span style={{ marginLeft: "10px" }}>{aModule.szRole}</span>
          </div>
          {aModule.vScenarios && aModule.vScenarios.length > 0 && (
            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: `1px solid ${CLR.szBorder}` }}>
              <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szRed, letterSpacing: "1.5px", marginBottom: "14px" }}>{aModule.szStatus === "built" ? "HOW IT'S USED" : "WHAT IT WILL DO"} · {aModule.vScenarios.length} SCENARIO{aModule.vScenarios.length > 1 ? "S" : ""}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {aModule.vScenarios.map((sc, i) => (
                  <div key={i} style={{ padding: "14px 16px", border: `1px solid ${CLR.szBorder}`, borderLeft: `3px solid ${aModule.szStatus === "built" ? CLR.szGreen : CLR.szTextDim}`, backgroundColor: CLR.szSurface, borderRadius: "3px" }}>
                    <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "14px", fontWeight: 600, color: CLR.szTextPrimary, marginBottom: "6px" }}>{sc.szTitle}</div>
                    <div style={{ fontSize: "13px", color: CLR.szTextSecondary, lineHeight: 1.6 }}>{sc.szBody}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: `1px solid ${CLR.szBorder}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <DepList szLabel="Depends on" vIds={aModule.vDepends} onPick={setModule} />
            <DepList szLabel="Used by" vIds={aModule.vUsedBy} onPick={setModule} />
          </div>
        </div>
      </div>
    </section>
  );
}

function DepList({ szLabel, vIds, onPick }) {
  return (
    <div>
      <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "1.5px", marginBottom: "8px" }}>{szLabel}</div>
      {vIds.length === 0 ? (
        <div style={{ fontSize: "13px", color: CLR.szTextDim, fontStyle: "italic" }}>(none)</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {vIds.map((id) => {
            const bPlanned = id.endsWith("-planned");
            const szRealId = bPlanned ? id.replace("-planned", "") : id;
            const aMod = MODULES.find((m) => m.szId === szRealId);
            return (
              <button key={id} disabled={bPlanned || !aMod} onClick={() => aMod && onPick(aMod.szId)}
                style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", padding: "5px 10px", border: `1px solid ${CLR.szBorder}`, backgroundColor: bPlanned ? CLR.szSurface : CLR.szCard, color: bPlanned ? CLR.szTextDim : CLR.szTextPrimary, borderRadius: "3px", cursor: bPlanned ? "not-allowed" : "pointer", letterSpacing: "0.5px" }}>
                {szRealId}{bPlanned ? " (planned)" : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- MODULE CONNECTION MAP ----------------------------------------------
//
// Layered top-down graph: all 21 modules grouped by their layer, with
// curved arrows from each module to its dependencies. Click any module
// to spotlight its full dependency chain (in + out). Built modules show
// in green, reserved modules in dashed grey.
// -------------------------------------------------------------------------

const CMAP_W = 880, CMAP_H = 660;

const CMAP_NODES = [
  // Layer 1
  { szId: "M-01", fX: 360, fY: 70  }, { szId: "M-21", fX: 560, fY: 70  },
  // Layer 2
  { szId: "M-02", fX: 110, fY: 180 }, { szId: "M-03", fX: 320, fY: 180 },
  { szId: "M-06", fX: 530, fY: 180 }, { szId: "M-09", fX: 740, fY: 180 },
  // Layer 3
  { szId: "M-04", fX: 110, fY: 290 }, { szId: "M-05", fX: 320, fY: 290 },
  { szId: "M-12", fX: 530, fY: 290 },
  // Layer 4
  { szId: "M-08", fX: 110, fY: 400 }, { szId: "M-16", fX: 320, fY: 400 },
  { szId: "M-17", fX: 530, fY: 400 },
  // Layer 5
  { szId: "M-07", fX: 60,  fY: 510 }, { szId: "M-10", fX: 240, fY: 510 },
  { szId: "M-11", fX: 420, fY: 510 }, { szId: "M-15", fX: 600, fY: 510 },
  // Layer 6
  { szId: "M-13", fX: 60,  fY: 615 }, { szId: "M-14", fX: 200, fY: 615 },
  { szId: "M-18", fX: 360, fY: 615 }, { szId: "M-19", fX: 520, fY: 615 },
  { szId: "M-20", fX: 680, fY: 615 },
];
const CMAP_NODE_W = 110, CMAP_NODE_H = 60;

function AstraConnectionMap() {
  const { bMobile } = useViewport();
  const [szSel, setSel] = useState(null);

  const fnNode = (id) => CMAP_NODES.find((n) => n.szId === id);
  const fnModule = (id) => MODULES.find((m) => m.szId === id);

  // Build edge list once.
  const vEdges = useMemo(() => {
    const out = [];
    MODULES.forEach((m) => {
      m.vDepends.forEach((dep) => {
        if (fnNode(m.szId) && fnNode(dep)) {
          out.push({ szFrom: m.szId, szTo: dep });
        }
      });
    });
    return out;
  }, []);

  const setHighlight = useMemo(() => {
    if (!szSel) return new Set();
    const s = new Set([szSel]);
    const aSel = fnModule(szSel);
    if (!aSel) return s;
    aSel.vDepends.forEach((d) => s.add(d));
    aSel.vUsedBy.map((x) => x.replace("-planned", "")).forEach((d) => s.add(d));
    return s;
  }, [szSel]);

  const aSel = szSel ? fnModule(szSel) : null;

  return (
    <section style={{ ...sxSectionPadding(bMobile) }}>
      <Reveal>
        <div style={SX_LABEL}>full topology · all 21 modules</div>
        <h2 style={SX_H2}>Every module, every dependency, in one picture.</h2>
        <p style={SX_LEAD}>
          Six built (green), fifteen reserved (grey). Arrows always run from a module to whatever it leans on. {bMobile ? "Tap" : "Click"} any module to light up its full dependency chain — both what it depends on and what depends on it. Layer 1 sits at the top because everything ultimately routes through it.{bMobile ? " On a phone the map scrolls horizontally — pinch to zoom for details." : ""}
        </p>
      </Reveal>

      <div style={{ display: "grid", gridTemplateColumns: bMobile ? "1fr" : "minmax(0, 2fr) minmax(0, 1fr)", gap: bMobile ? "14px" : "20px" }}>
        {/* SVG map */}
        <div style={{ padding: bMobile ? "10px" : "16px", border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szCard, borderRadius: "4px", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <svg viewBox={`0 0 ${CMAP_W} ${CMAP_H}`} width={bMobile ? CMAP_W : "100%"} style={{ display: "block", maxHeight: bMobile ? "none" : "720px", minWidth: bMobile ? `${CMAP_W}px` : "auto" }}>
            <defs>
              <marker id="cm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={CLR.szRed} />
              </marker>
              <marker id="cm-arrow-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={CLR.szBorder} />
              </marker>
            </defs>

            {/* Layer band labels */}
            {[
              { iLayer: 1, fY: 50,  szLbl: "L1 — Core" },
              { iLayer: 2, fY: 160, szLbl: "L2 — Services (built)" },
              { iLayer: 3, fY: 270, szLbl: "L3 — Security (reserved)" },
              { iLayer: 4, fY: 380, szLbl: "L4 — Intelligence (reserved)" },
              { iLayer: 5, fY: 490, szLbl: "L5 — Application (reserved)" },
              { iLayer: 6, fY: 595, szLbl: "L6 — Infrastructure (reserved)" },
            ].map((b) => (
              <text key={b.iLayer} x="6" y={b.fY - 4} fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim} letterSpacing="1.5px">{b.szLbl.toUpperCase()}</text>
            ))}

            {/* Edges */}
            {vEdges.map((e, i) => {
              const src = fnNode(e.szFrom);
              const dst = fnNode(e.szTo);
              if (!src || !dst) return null;
              const x1 = src.fX + CMAP_NODE_W / 2, y1 = src.fY;
              const x2 = dst.fX + CMAP_NODE_W / 2, y2 = dst.fY + CMAP_NODE_H;
              const cy = (y1 + y2) / 2;
              const path = `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`;
              const bHi = szSel && (e.szFrom === szSel || e.szTo === szSel);
              const bDim = szSel && !bHi;
              return (
                <path key={i} d={path}
                  fill="none"
                  stroke={bHi ? CLR.szRed : CLR.szBorder}
                  strokeWidth={bHi ? 2 : 1}
                  opacity={bDim ? 0.18 : 1}
                  markerEnd={bHi ? "url(#cm-arrow)" : "url(#cm-arrow-dim)"} />
              );
            })}

            {/* Nodes */}
            {CMAP_NODES.map((n) => {
              const aMod = fnModule(n.szId);
              if (!aMod) return null;
              const bBuilt = aMod.szStatus === "built";
              const bSel = szSel === n.szId;
              const bHi = setHighlight.has(n.szId);
              const bDim = szSel && !bHi;
              return (
                <g key={n.szId} style={{ cursor: "pointer" }} onClick={() => setSel((p) => p === n.szId ? null : n.szId)}>
                  <rect x={n.fX} y={n.fY} width={CMAP_NODE_W} height={CMAP_NODE_H} rx="4"
                    fill={bSel ? CLR.szRed : (bBuilt ? CLR.szGreen : CLR.szSurface)}
                    stroke={bSel ? CLR.szRedDark : (bBuilt ? CLR.szGreen : CLR.szBorder)}
                    strokeWidth={bSel ? 2 : 1}
                    strokeDasharray={bBuilt ? undefined : "4,3"}
                    opacity={bDim ? 0.35 : 1}
                    style={{ transition: "all .2s" }} />
                  <text x={n.fX + CMAP_NODE_W / 2} y={n.fY + 22} textAnchor="middle"
                    fontSize="12" fontFamily="'Geist Mono', 'JetBrains Mono', monospace"
                    fontWeight="600"
                    fill={bSel || bBuilt ? "#fff" : CLR.szTextPrimary}
                    opacity={bDim ? 0.5 : 1}
                    pointerEvents="none">{n.szId}</text>
                  <text x={n.fX + CMAP_NODE_W / 2} y={n.fY + 40} textAnchor="middle"
                    fontSize="10" fontFamily="'Geist', system-ui, sans-serif"
                    fill={bSel ? "rgba(255,255,255,0.95)" : (bBuilt ? "rgba(255,255,255,0.95)" : CLR.szTextSecondary)}
                    opacity={bDim ? 0.5 : 1}
                    pointerEvents="none">{aMod.szName}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Side panel */}
        <div style={{ padding: bMobile ? "16px" : "20px", border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szCard, borderRadius: "4px", height: "fit-content", position: bMobile ? "static" : "sticky", top: bMobile ? "auto" : "100px" }}>
          {!aSel && (
            <>
              <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "1.5px", marginBottom: "12px" }}>HOW TO READ THIS MAP</div>
              <ul style={{ fontSize: "13px", color: CLR.szTextSecondary, lineHeight: 1.7, paddingLeft: "18px", marginTop: 0 }}>
                <li><strong style={{ color: CLR.szGreen }}>Solid green</strong> = built and tested today (6 modules)</li>
                <li><strong>Dashed grey</strong> = reserved scaffolding, not built (15 modules)</li>
                <li>Curved lines run <strong>from a module to whatever it depends on</strong></li>
                <li>The graph is a <strong>strict DAG</strong> — no circular dependencies</li>
                <li><strong>Click any module</strong> to spotlight its full dependency chain</li>
              </ul>
              <div style={{ marginTop: "20px", padding: "12px 14px", backgroundColor: CLR.szSurface, borderRadius: "3px", fontSize: "12px", color: CLR.szTextSecondary, lineHeight: 1.6, fontFamily: "'Geist', sans-serif" }}>
                <strong>Why M-01 is the hub:</strong> capability tokens, the service registry, the event bus, and the process manager all live there. Every other module either uses one of those four things directly, or talks to another module through the EventBus.
              </div>
            </>
          )}
          {aSel && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div>
                  <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szRed, letterSpacing: "1.5px" }}>{aSel.szId}</div>
                  <div style={{ fontFamily: "'Geist', sans-serif", fontSize: "20px", fontWeight: 600, color: CLR.szTextPrimary, marginTop: "2px" }}>{aSel.szName}</div>
                </div>
                <span style={{ padding: "4px 10px", backgroundColor: aSel.szStatus === "built" ? CLR.szGreen : CLR.szSurface, color: aSel.szStatus === "built" ? "#fff" : CLR.szTextSecondary, borderRadius: "3px", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "1.5px" }}>{aSel.szStatus === "built" ? "BUILT" : "RESERVED"}</span>
              </div>
              <div style={{ fontSize: "13px", color: CLR.szTextSecondary, lineHeight: 1.6, marginBottom: "16px" }}>{aSel.szPlain}</div>

              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "1.5px", marginBottom: "6px" }}>DEPENDS ON</div>
                {aSel.vDepends.length === 0 ? (
                  <div style={{ fontSize: "12px", color: CLR.szTextDim, fontStyle: "italic" }}>(nothing — this is a foundation module)</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {aSel.vDepends.map((id) => {
                      const d = fnModule(id);
                      return (
                        <button key={id} onClick={() => setSel(id)}
                          style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", padding: "4px 10px", border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szCard, color: CLR.szTextPrimary, borderRadius: "3px", cursor: "pointer" }}>
                          {id}{d ? ` · ${d.szName}` : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "1.5px", marginBottom: "6px" }}>USED BY</div>
                {aSel.vUsedBy.length === 0 ? (
                  <div style={{ fontSize: "12px", color: CLR.szTextDim, fontStyle: "italic" }}>(nothing yet — leaf module)</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {aSel.vUsedBy.map((id) => {
                      const bPlanned = id.endsWith("-planned");
                      const realId = bPlanned ? id.replace("-planned", "") : id;
                      const d = fnModule(realId);
                      return (
                        <button key={id} disabled={bPlanned || !d} onClick={() => d && setSel(realId)}
                          style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", padding: "4px 10px", border: `1px solid ${CLR.szBorder}`, backgroundColor: bPlanned ? CLR.szSurface : CLR.szCard, color: bPlanned ? CLR.szTextDim : CLR.szTextPrimary, borderRadius: "3px", cursor: bPlanned ? "not-allowed" : "pointer" }}>
                          {realId}{bPlanned ? " (planned)" : ""}{d ? ` · ${d.szName}` : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginTop: "16px", padding: "10px 12px", backgroundColor: CLR.szSurface, borderRadius: "3px", fontSize: "12px", color: CLR.szTextSecondary, lineHeight: 1.5 }}>
                <span style={{ color: CLR.szRed, fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "1.5px" }}>ROLE</span>
                <span style={{ marginLeft: "8px" }}>{aSel.szRole}</span>
              </div>

              <button onClick={() => setSel(null)} style={{ marginTop: "14px", padding: "8px 12px", border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szCard, color: CLR.szTextSecondary, borderRadius: "3px", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "1px", cursor: "pointer", width: "100%" }}>CLEAR SELECTION</button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ---- INTERACTIVE SCENARIO PLAYER ----------------------------------------
//
// Replaces the abstract dependency graph with concrete walk-throughs of
// real things Astra does. Each scenario has its own module layout + steps;
// stepping forward highlights the active modules and draws a moving arrow
// of which module is talking to which module *right now*.
// -------------------------------------------------------------------------

const SCENARIOS = [
  {
    szId: "spawn",
    szTitle: "Run a sandboxed program",
    szPlain: "You ask Astra to launch /bin/bash inside a sandbox. Watch how M-01 hands the request through to M-02 to build the cage, then publishes a tracing event to M-09. No kernel patch, no Docker daemon.",
    vNodes: [
      { szId: "Caller",  szLabel: "Your code",         szSub: "spawn(/bin/bash)",     fX: 60,  fY: 100, iW: 130 },
      { szId: "M-01-PM", szLabel: "M-01 ProcessMgr",   szSub: "supervisor",           fX: 240, fY: 50,  iW: 140 },
      { szId: "M-01-CM", szLabel: "M-01 CapabilityMgr",szSub: "validate token",       fX: 240, fY: 150, iW: 140 },
      { szId: "M-01-HR", szLabel: "M-01 HookRegistry", szSub: "PRE_SPAWN chain",      fX: 430, fY: 50,  iW: 150 },
      { szId: "M-02-NS", szLabel: "M-02 NamespaceMgr", szSub: "unshare + pivot_root", fX: 620, fY: 100, iW: 150 },
      { szId: "M-09",    szLabel: "M-09 eBPF",         szSub: "ring buffer poll",     fX: 430, fY: 220, iW: 150 },
    ],
    vSteps: [
      { szTitle: "Your code requests a sandbox", szBody: "Any caller — a service, a CLI, a test harness — calls runtime.processes().spawn({binary: \"/bin/bash\", profile: PARANOID, ...}). The config carries an isolation profile, environment variables, and an argv vector. The caller must also hand a capability token; the runtime will not even look at the config without one. No token, no spawn — fail at the door.", vActive: ["Caller", "M-01-PM"], vEdges: [["Caller", "M-01-PM", "spawn(config, token)"]] },
      { szTitle: "M-01 checks the capability", szBody: "ProcessManager asks CapabilityManager: \"does this token carry PROC_SPAWN?\" The validate() walks the active token pool (default cap 4,096 entries), compares the token's 128-bit unique ID, checks the epoch counter against the registry's current epoch (mismatch = revoked), then ANDs the permission bitmask against PROC_SPAWN. With a hot pool the cost lands in the low microseconds today; the planned hash-indexed fast path drops it into the ~10s of nanoseconds bracket required by the IPC hot path. Any failure → return CAPABILITY_INVALID, audit-emit, exit.", vActive: ["M-01-PM", "M-01-CM"], vEdges: [["M-01-PM", "M-01-CM", "validate(token, PROC_SPAWN)"]] },
      { szTitle: "PRE_SPAWN hooks fire (via IsolationHook today)", szBody: "Capability is good. M-01 invokes the registered isolation hook before fork. Today this uses the legacy single-hook setIsolationHook() wrapper that M-02's IsolationService::onStart() installs — only one hook, no priority chain. The general-purpose HookRegistry with priority-ordered chains (PRE_SPAWN / POST_FORK / POST_SPAWN / PRE_KILL / POST_EXIT) already exists in M-01 and is what future modules — M-22 AgentGuard, M-07 Job Engine — will use; M-02 will be migrated onto it once a second hook needs to share the slot.", vActive: ["M-01-PM", "M-01-HR"], vEdges: [["M-01-PM", "M-01-HR", "isolationHook(pid, profile)"]] },
      { szTitle: "M-02 builds the namespaces", szBody: "Inside M-02's hook, NamespaceManager runs four syscalls in order: unshare(CLONE_NEWUSER) creates a fresh user namespace; write \"deny\" to /proc/self/setgroups; write \"0 1000 1\" to /proc/self/uid_map (inside-uid 0 = host-uid 1000); unshare(CLONE_NEWPID | CLONE_NEWNS) for the process tree and mount table. From this point on, the spawning process has its own private view; the eventual fork inherits that view.", vActive: ["M-01-HR", "M-02-NS"], vEdges: [["M-01-HR", "M-02-NS", "setup(profile, uid, gid)"]] },
      { szTitle: "M-02 builds the tmpfs sandbox + pivot_root", szBody: "Critical step that took two PR review rounds to get right: first mount(NULL, \"/\", NULL, MS_REC|MS_PRIVATE, NULL) so any sandbox mounts don't propagate back to the host (systemd default is MS_SHARED — would leak). Then mount a 64 MiB tmpfs at /tmp/astra_sandbox/<pid>, bind-mount /usr/lib + /usr/share read-only, syscall(SYS_pivot_root, ...) to swap roots, chdir(\"/\"), and finally umount2(\"/.oldroot\", MNT_DETACH). The sandbox can no longer see /etc, /home, or anything outside its tmpfs.", vActive: ["M-02-NS"], vEdges: [] },
      { szTitle: "M-01 forks + execs the binary", szBody: "Hooks done. Back in ProcessManager. fork() returns the child, which inherits the namespace + mount setup. The child is now structurally a different process from the parent — different user IDs, different process tree, different filesystem. exec(\"/bin/bash\") replaces the child's image with the requested binary. By the time bash's main runs, the parent process is gone (replaced) and the child sees only the sandbox tmpfs.", vActive: ["M-01-PM"], vEdges: [["M-01-PM", "M-01-PM", "fork() + exec()"]] },
      { szTitle: "M-09 records the spawn event", szBody: "ProcessManager publishes PROCESS_SPAWNED on the EventBus — a 64-byte cache-aligned event with the new pid, the parent pid, the binary path hash, and the timestamp. M-09 eBPF subscribed to that event type at startup, so its callback fires synchronously and emits a USDT tracepoint that the kernel-side task_spawn.bpf.c probe captures into the BPF ring buffer. The userspace ingestion thread drains it microseconds later. Zero CPU overhead per spawn beyond the tracepoint itself (~50 cycles).", vActive: ["M-01-PM", "M-09"], vEdges: [["M-01-PM", "M-09", "PROCESS_SPAWNED event"]] },
    ],
  },

  {
    szId: "ipc",
    szTitle: "Two services exchange a message",
    szPlain: "Service A wants to send a 64-byte status update to Service B. Both run inside Astra. The message never gets copied — they share the same memfd-backed memory region. The capability check on every send and receive is the planned next-sprint integration; the M-01 cap infrastructure already exists, the M-03 IPC plumbing for it does not. Steps below note (planned) where that's the case.",
    vNodes: [
      { szId: "SvcA",    szLabel: "Service A",          szSub: "producer",            fX: 60,  fY: 100, iW: 130 },
      { szId: "M-03-CF", szLabel: "M-03 ChannelFactory",szSub: "memfd + mmap",        fX: 240, fY: 30,  iW: 160 },
      { szId: "M-03-RB", szLabel: "M-03 RingBuffer",    szSub: "shared memory",       fX: 380, fY: 130, iW: 160 },
      { szId: "M-01-CM", szLabel: "M-01 CapabilityMgr", szSub: "validate IPC perms",  fX: 240, fY: 230, iW: 160 },
      { szId: "SvcB",    szLabel: "Service B",          szSub: "consumer (futex)",    fX: 600, fY: 100, iW: 130 },
    ],
    vSteps: [
      { szTitle: "M-03 creates a shared channel", szBody: "Once at setup time. ChannelFactory calls memfd_create + ftruncate + mmap(MAP_SHARED) to create one piece of memory both services can see. The control block (3 cache lines) and ring buffer live in that shared region.", vActive: ["M-03-CF", "M-03-RB"], vEdges: [["M-03-CF", "M-03-RB", "createChannel(2 MB ring)"]] },
      { szTitle: "Service A: \"send this status\" (with planned capability gate)", szBody: "Service A calls ring.write(data, 64). In the next sprint, M-03 will ask M-01 to validate the IPC_SEND permission on Service A's capability token before the atomic claim. Today the IPC fast path skips the validate call — wiring it in is part of Paper 1's prep work. The capability check itself, on the M-01 side, already exists and runs against the live token table.", vActive: ["SvcA", "M-01-CM"], vEdges: [["SvcA", "M-01-CM", "(planned) validate(token, IPC_SEND)"]] },
      { szTitle: "Wait-free claim: fetch_add", szBody: "Capability passes. M-03 reserves space with one atomic fetch_add on the write_claim_index — a single CPU instruction. Multiple producers can race here; whoever gets the lower offset wins. Total cost: ~1 ns.", vActive: ["SvcA", "M-03-RB"], vEdges: [["SvcA", "M-03-RB", "fetch_add(write_claim, 72)"]] },
      { szTitle: "Write header + payload, commit", szBody: "Service A writes an 8-byte MessageHeader (size + sequence number) followed by the 64-byte payload directly into the shared memory. No copying. Then it CASes write_index forward to publish the message to readers.", vActive: ["M-03-RB"], vEdges: [] },
      { szTitle: "Service B was sleeping on a futex", szBody: "Meanwhile, Service B called readWait(). When the ring was empty, it parked on a futex via std::atomic::wait. The kernel was using zero CPU for it. Service A's commit triggers a notify_one which wakes B.", vActive: ["M-03-RB", "SvcB"], vEdges: [["M-03-RB", "SvcB", "futex notify_one"]] },
      { szTitle: "Service B reads (capability gate planned for both ends)", szBody: "Service B's read() will, in the planned-sprint signature, validate IPC_RECV against its own token before the memcpy and read_index advance. Today read() returns the payload bytes without that gate — the M-01 capability infrastructure exists, but is not yet plumbed into M-03's read path. End-to-end latency target after wiring: well under a microsecond.", vActive: ["SvcB", "M-01-CM"], vEdges: [["SvcB", "M-01-CM", "(planned) validate(token, IPC_RECV)"]] },
    ],
  },

  {
    szId: "revoke",
    szTitle: "Revoke a compromised token — instantly, everywhere",
    szPlain: "M-09 eBPF spots a service doing something it shouldn't — say, an unexpected syscall pattern. The runtime revokes that service's capability token. In one bump-the-epoch operation, every send, every alloc, every spawn that token could authorise is blocked. O(1) for the whole subtree.",
    vNodes: [
      { szId: "M-09",    szLabel: "M-09 eBPF",          szSub: "anomaly detected",   fX: 60,  fY: 100, iW: 150 },
      { szId: "M-01-EB", szLabel: "M-01 EventBus",      szSub: "SECURITY_ALERT",     fX: 250, fY: 100, iW: 160 },
      { szId: "M-01-CM", szLabel: "M-01 CapabilityMgr", szSub: "epoch++",            fX: 460, fY: 100, iW: 170 },
      { szId: "M-03",    szLabel: "M-03 IPC",           szSub: "next send fails",    fX: 660, fY: 30,  iW: 130 },
      { szId: "M-06",    szLabel: "M-06 Allocator",     szSub: "next alloc fails",   fX: 660, fY: 130, iW: 130 },
      { szId: "Atk",     szLabel: "Compromised svc",    szSub: "structurally dead",  fX: 660, fY: 230, iW: 150 },
    ],
    vSteps: [
      { szTitle: "M-09 spots something off", szBody: "An eBPF probe in the kernel sees the service issuing syscalls that don't match its baseline. It writes the anomaly to its ring buffer; the userspace poller picks it up.", vActive: ["M-09"], vEdges: [] },
      { szTitle: "Security event published", szBody: "M-09 publishes SECURITY_ALERT on the EventBus. Any service that subscribed to that event type — including the policy engine — gets it.", vActive: ["M-09", "M-01-EB"], vEdges: [["M-09", "M-01-EB", "publish(SECURITY_ALERT)"]] },
      { szTitle: "Policy decides to revoke", szBody: "The policy says: \"this token is no longer trustworthy.\" It calls capabilities.revoke(token). Inside CapabilityManager, all that does is bump the token's epoch counter — a single atomic store.", vActive: ["M-01-EB", "M-01-CM"], vEdges: [["M-01-EB", "M-01-CM", "revoke(token)"]] },
      { szTitle: "Cascading revocation — for free", szBody: "Every token derived from this one inherits the parent's epoch. Once the parent's epoch moves, every child's validate() will see a mismatch and fail. There's no tree to walk — the revocation is implicit. O(1).", vActive: ["M-01-CM"], vEdges: [] },
      { szTitle: "Next send: blocked", szBody: "The compromised service tries to send a message. M-03 calls validate() before the write. Epoch mismatch. Send rejected. The service can no longer talk to anyone.", vActive: ["M-01-CM", "M-03", "Atk"], vEdges: [["M-03", "M-01-CM", "validate (FAIL)"], ["Atk", "M-03", "(blocked)"]] },
      { szTitle: "Next alloc: blocked", szBody: "It tries to malloc. M-06 calls validate(MEM_ALLOC). Same epoch mismatch. Memory denied. The compromised service can't grow.", vActive: ["M-01-CM", "M-06", "Atk"], vEdges: [["M-06", "M-01-CM", "validate (FAIL)"], ["Atk", "M-06", "(blocked)"]] },
      { szTitle: "Structurally disabled", szBody: "Without a working capability, the service can't do anything that touches the runtime. No IPC. No memory. No spawning children. It still exists as a process — but it is now harmless. This is the unique guarantee Astra offers.", vActive: ["Atk"], vEdges: [] },
    ],
  },

  {
    szId: "alloc",
    szTitle: "Allocate memory the safe way",
    szPlain: "A service asks M-06 for 4 KB. Allocator walks three checks before handing memory back: capability, quota, then poison-pattern integrity. Every allocation and free emits an audit event into the M-09 telemetry pipeline.",
    vNodes: [
      { szId: "Svc",     szLabel: "Service",             szSub: "needs 4 KB",          fX: 60,  fY: 100, iW: 130 },
      { szId: "M-06",    szLabel: "M-06 Allocator",      szSub: "4-tier pool",         fX: 240, fY: 100, iW: 150 },
      { szId: "M-01-CM", szLabel: "M-01 CapabilityMgr",  szSub: "MEM_ALLOC?",          fX: 440, fY: 30,  iW: 160 },
      { szId: "M-06-Q",  szLabel: "QuotaManager",        szSub: "per-module budget",   fX: 440, fY: 110, iW: 160 },
      { szId: "M-06-P",  szLabel: "PoolAllocator",       szSub: "small/med/large",     fX: 440, fY: 190, iW: 160 },
      { szId: "M-09",    szLabel: "M-09 eBPF",           szSub: "audit pipeline",      fX: 660, fY: 100, iW: 130 },
    ],
    vSteps: [
      { szTitle: "Service requests memory", szBody: "Service calls allocator.allocateFor(ModuleId::IPC, 4096, capToken). It says who it is (the module ID), how much it wants (4 KB), and presents a token to prove it's allowed. The token was given to it at startup by whatever derived a capability scoped down to MEM_ALLOC.", vActive: ["Svc", "M-06"], vEdges: [["Svc", "M-06", "allocateFor(IPC, 4096, token)"]] },
      { szTitle: "Capability check", szBody: "M-06 asks M-01: \"does this token carry MEM_ALLOC?\" The check is one cache-line load + bitmask AND + epoch compare — about 10 nanoseconds, lock-free. If the token has been revoked since the service started, the epoch will not match and validation fails. An audit event for the rejection is emitted regardless.", vActive: ["M-06", "M-01-CM"], vEdges: [["M-06", "M-01-CM", "validate(token, MEM_ALLOC)"]] },
      { szTitle: "Quota check", szBody: "Capability is fine. QuotaManager: \"has the IPC module already used its 64 MB budget this minute?\" Quotas are tracked per-module so a runaway component can't eat all RAM at the expense of others. tryReserve does an atomic compare-and-add on the module's bucket; on overflow → RESOURCE_EXHAUSTED.", vActive: ["M-06", "M-06-Q"], vEdges: [["M-06", "M-06-Q", "tryReserve(IPC, 4096)"]] },
      { szTitle: "Tier routing", szBody: "Both checks pass. PoolAllocator picks the right tier (4 KB falls into the small-tier slab pool, which holds 16-page slabs) and pops a free slab off the freelist — O(1). Before handing it over, M-06 verifies the slab's poison pattern (0xDEADBEEF) is intact; corruption means a use-after-free happened on the previous holder, and the alloc fails.", vActive: ["M-06", "M-06-P"], vEdges: [["M-06", "M-06-P", "tier=small → slab"]] },
      { szTitle: "Audit event published", szBody: "M-06 emits an ALLOC AuditEvent to M-09's telemetry stream. Every allocation, every free, every quota rejection, every poison-pattern violation ends up there. Useful for the M-08 AI subsystem (later sprint) to learn allocation patterns, and for live forensics during an incident — the event log is the single source of truth for who allocated what when.", vActive: ["M-06", "M-09"], vEdges: [["M-06", "M-09", "AuditEvent::ALLOC"]] },
    ],
  },

  // ===== Reserved-module scenarios (planned) =====
  {
    szId: "checkpoint",
    szTitle: "Save and restore a process (planned)",
    szPlain: "A long-running sandboxed process needs to be checkpointed so it can be migrated to another host or replayed for forensics. M-04 snapshots the address space, M-19 freezes its logical clock, and M-05 plays it back later — all without kernel patches. None of these modules are built today; this scenario shows the planned interaction.",
    vNodes: [
      { szId: "Svc",  szLabel: "Running process",     szSub: "needs snapshot",      fX: 50,  fY: 110, iW: 140 },
      { szId: "M-01", szLabel: "M-01 ProcessMgr",     szSub: "freezes target",      fX: 240, fY: 30,  iW: 150 },
      { szId: "M-04", szLabel: "M-04 Checkpoint",     szSub: "dumps memory + fds",  fX: 240, fY: 110, iW: 150 },
      { szId: "M-19", szLabel: "M-19 Virtual Time",   szSub: "snapshots clock",     fX: 240, fY: 190, iW: 150 },
      { szId: "Disk", szLabel: ".astra-snap file",    szSub: "on disk",             fX: 440, fY: 110, iW: 140 },
      { szId: "M-05", szLabel: "M-05 Replay",         szSub: "deterministic",       fX: 620, fY: 110, iW: 140 },
    ],
    vSteps: [
      { szTitle: "Freeze the target", szBody: "M-01 ProcessManager sends SIGSTOP via ptrace, walking the supervision tree to pause every child. M-19 captures the current logical clock so the snapshot is timestamped against the runtime's virtual time, not wall-clock time.", vActive: ["Svc", "M-01", "M-19"], vEdges: [["M-01", "Svc", "ptrace SIGSTOP"], ["M-01", "M-19", "snapshot(clock)"]] },
      { szTitle: "Dump address space", szBody: "M-04 reads /proc/<pid>/maps to enumerate VMAs, then for each writable VMA copies the pages out to the snapshot file. Read-only and shared-mapped VMAs are recorded by reference (path + offset), not copied — the restore side will mmap them again. Open file descriptors are captured by walking /proc/<pid>/fd.", vActive: ["Svc", "M-04", "Disk"], vEdges: [["M-04", "Svc", "read /proc/<pid>/maps"], ["M-04", "Disk", "write VMA pages"]] },
      { szTitle: "Snapshot file written", szBody: "Disk now holds: register state, VMA list + dirty pages, fd table, the clock's logical timestamp. Hybrid PQC signature (M-18, when it ships) over the manifest so the snapshot can't be tampered with on disk.", vActive: ["Disk"], vEdges: [] },
      { szTitle: "Hours later — restore", szBody: "M-05 reads the snapshot manifest, allocates a fresh PID inside a new sandbox (calling the same M-02 namespace setup), recreates the VMAs in the same order, restores register state via PTRACE_SETREGS. The result is a process at exactly the same execution point as when checkpointed.", vActive: ["M-05", "Disk"], vEdges: [["Disk", "M-05", "load manifest"], ["M-05", "M-19", "restore(clock)"]] },
      { szTitle: "Replay continues deterministically", szBody: "Because M-19 controls the logical clock, time-dependent code in the restored process sees the same values it saw during the original run. Combined with replayed syscall results (recorded during checkpointing), this gives byte-for-byte reproduction. The basis for the M-05 / M-04 paper at EuroSys 2028.", vActive: ["M-05", "M-19"], vEdges: [["M-05", "M-19", "advance(virtual)"]] },
    ],
  },

  {
    szId: "agent",
    szTitle: "AI agent invokes a tool — safely (planned)",
    szPlain: "An LLM-powered coding agent wants to run shell commands and read files. Without a runtime, it has unrestricted access. With Astra's planned M-22 AgentGuard, every tool call is gated by a capability scoped to that exact session, prompt-data taint stops a poisoned web page from injecting commands, and M-05 records the entire run for replay.",
    vNodes: [
      { szId: "LLM",  szLabel: "LLM agent",         szSub: "tool call",            fX: 50,  fY: 110, iW: 130 },
      { szId: "M-22", szLabel: "M-22 ToolBroker",   szSub: "policy check",         fX: 220, fY: 30,  iW: 150 },
      { szId: "M-01", szLabel: "M-01 CapabilityMgr",szSub: "AGENT_TOOL_INVOKE",    fX: 220, fY: 110, iW: 160 },
      { szId: "Taint",szLabel: "M-22 TaintTracker", szSub: "prompt vs system",     fX: 220, fY: 195, iW: 160 },
      { szId: "M-02", szLabel: "M-02 Isolation",    szSub: "execute in sandbox",   fX: 430, fY: 110, iW: 150 },
      { szId: "M-05", szLabel: "M-05 Replay log",   szSub: "record everything",    fX: 620, fY: 30,  iW: 150 },
      { szId: "M-09", szLabel: "M-09 eBPF",         szSub: "syscall trace",        fX: 620, fY: 195, iW: 150 },
    ],
    vSteps: [
      { szTitle: "Agent issues a tool call", szBody: "The LLM emits {\"tool\":\"shell\",\"cmd\":\"ls /var/log\"}. Today this would just run. With AgentGuard, the call hits M-22's ToolBroker first — every model-issued action is mediated.", vActive: ["LLM", "M-22"], vEdges: [["LLM", "M-22", "shell(\"ls /var/log\")"]] },
      { szTitle: "Capability check on the agent's session token", szBody: "Each agent session gets its own capability — say, AGENT_TOOL_INVOKE | FS_READ scoped to /var/log only. M-22 calls M-01.validate against the session token. If the agent tries to list /etc/shadow, the capability won't authorise it; rejected at the broker.", vActive: ["M-22", "M-01"], vEdges: [["M-22", "M-01", "validate(token, AGENT_TOOL_INVOKE)"]] },
      { szTitle: "Taint check on the arguments", szBody: "M-22 also checks data provenance. If the cmd argument was constructed from text that came in via tool output (e.g., a fetched web page), it carries a 'tainted' tag. Privileged tool args refuse tainted input — this stops prompt-injection attacks where a poisoned web page tells the agent to delete files.", vActive: ["M-22", "Taint"], vEdges: [["M-22", "Taint", "isTainted(cmd)?"]] },
      { szTitle: "Execute inside the sandbox", szBody: "Both checks pass. M-22 hands the call to M-02, which spawns a fresh sandbox with only the namespaces the agent is allowed to touch (typically a tmpfs root + read-only /var/log). The shell command runs there.", vActive: ["M-22", "M-02"], vEdges: [["M-22", "M-02", "spawn(profile=AGENT_RW)"]] },
      { szTitle: "Recorded for forensic replay", szBody: "Every input, every tool call, every syscall the sandbox issues is logged via M-09 to a checkpoint stream M-05 keeps. If the agent later does something unexpected, the analyst rewinds and replays the exact session — a deterministic forensic trail. This is the differentiator vs every other AI agent runtime in 2026.", vActive: ["M-02", "M-05", "M-09"], vEdges: [["M-09", "M-05", "trace + checkpoint"]] },
    ],
  },

  {
    szId: "modload",
    szTitle: "Hot-load a signed module (planned)",
    szPlain: "Astra needs to live-patch its M-02 isolation logic for a new CVE — without restarting the runtime. M-20 verifies a hybrid post-quantum signature (M-18 + M-21), checks the binary is hardened, and swaps the new module in via M-10's component lifecycle. None of this is built; the scenario shows the planned chain.",
    vNodes: [
      { szId: "Adm",  szLabel: "Admin",             szSub: "drops .so",          fX: 50,  fY: 110, iW: 110 },
      { szId: "M-20", szLabel: "M-20 Loader",       szSub: "inotify watch",      fX: 200, fY: 110, iW: 150 },
      { szId: "M-18", szLabel: "M-18 Crypto",       szSub: "Ed25519 + ML-DSA",   fX: 390, fY: 30,  iW: 160 },
      { szId: "M-21", szLabel: "M-21 ASM Core",     szSub: "ct_compare",         fX: 390, fY: 110, iW: 160 },
      { szId: "Elf",  szLabel: "ELF inspector",     szSub: "RELRO / canary?",    fX: 390, fY: 195, iW: 160 },
      { szId: "M-10", szLabel: "M-10 WASM/Comp",    szSub: "hot-swap",           fX: 590, fY: 110, iW: 150 },
      { szId: "M-01", szLabel: "M-01 ServiceReg",   szSub: "swap binding",       fX: 770, fY: 110, iW: 130 },
    ],
    vSteps: [
      { szTitle: "Admin drops a new signed module", szBody: "An operator copies the new .so into the modules directory. The module manifest carries an Ed25519 signature for legacy verification AND an ML-DSA-65 (FIPS 204) signature for post-quantum security. M-20 picks it up via inotify within milliseconds.", vActive: ["Adm", "M-20"], vEdges: [["Adm", "M-20", "drop file"]] },
      { szTitle: "Verify the hybrid PQC signature", szBody: "M-20 hands the manifest to M-18 Crypto, which runs both signature checks in parallel. If either fails → reject. M-21's constant-time ct_compare is used for the public-key fingerprint match so a timing side-channel can't leak which key was tried.", vActive: ["M-20", "M-18", "M-21"], vEdges: [["M-20", "M-18", "verify(Ed25519 + ML-DSA)"], ["M-18", "M-21", "ct_compare(fp)"]] },
      { szTitle: "Inspect the binary's hardening", szBody: "Signature OK ≠ binary safe. M-20 walks the ELF: must have a stack canary (.note.gnu.property), full RELRO (DT_BIND_NOW + GNU_RELRO segment), NX stack (PT_GNU_STACK with no PF_X), no executable writable sections. Any miss → reject. These checks are non-bypassable.", vActive: ["M-20", "Elf"], vEdges: [["M-20", "Elf", "inspect ELF flags"]] },
      { szTitle: "Hot-swap via the component lifecycle", szBody: "All checks passed. M-10's component framework loads the new module's code, calls onInit on it, then atomically swaps the ServiceRegistry binding for ModuleId::ISOLATION from the old to the new instance. Existing in-flight calls finish on the old code; new calls go to the new code. Zero downtime.", vActive: ["M-10", "M-01"], vEdges: [["M-10", "M-01", "swap binding atomic"]] },
      { szTitle: "Old module quiesces and gets reaped", szBody: "Reference counting on the old module instance drops to zero once the last in-flight call returns. M-10 calls onStop on it, then reclaims its memory. The runtime is now patched. No restart, no SLA hit, full audit trail in M-09's event stream.", vActive: ["M-10"], vEdges: [] },
    ],
  },
];

function AstraScenarioPlayer() {
  const { bMobile } = useViewport();
  const [iScenario, setScenario] = useState(0);
  const [iStep, setStep] = useState(0);
  const [bAuto, setAuto] = useState(false);

  const aSc = SCENARIOS[iScenario];
  const aStep = aSc.vSteps[iStep];

  // auto-advance
  useEffect(() => {
    if (!bAuto) return;
    const id = setInterval(() => {
      setStep((s) => (s + 1) % aSc.vSteps.length);
    }, 3000);
    return () => clearInterval(id);
  }, [bAuto, iScenario, aSc.vSteps.length]);

  const fnPickScenario = (i) => { setScenario(i); setStep(0); setAuto(false); };

  const W = 800, H = 320;

  // map active set
  const setActive = new Set(aStep.vActive);

  return (
    <section style={{ ...sxSectionPadding(bMobile) }}>
      <Reveal>
        <div style={SX_LABEL}>see it in action · 7 scenarios</div>
        <h2 style={SX_H2}>Pick a scenario. Watch the modules talk to each other.</h2>
        <p style={SX_LEAD}>
          Astra's modules are interconnected through three plumbing primitives — direct calls on the Runtime, hook chains, and the EventBus. Below, watch four real things Astra does, broken into the exact handoffs between modules. Click <strong>NEXT</strong> to step through, or hit auto-play.
        </p>
      </Reveal>

      {/* Scenario tabs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginBottom: "18px" }}>
        {SCENARIOS.map((s, i) => {
          const bActive = i === iScenario;
          return (
            <button key={s.szId} onClick={() => fnPickScenario(i)}
              style={{ cursor: "pointer", textAlign: "left", padding: "14px 16px", border: `1px solid ${bActive ? CLR.szRed : CLR.szBorder}`, backgroundColor: bActive ? CLR.szRed : CLR.szCard, color: bActive ? "#fff" : CLR.szTextPrimary, borderRadius: "4px", transition: "all .2s" }}>
              <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: bActive ? "rgba(255,255,255,0.7)" : CLR.szTextDim, letterSpacing: "1.5px" }}>SCENARIO {i + 1}</div>
              <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "14px", fontWeight: 600, marginTop: "4px", lineHeight: 1.25 }}>{s.szTitle}</div>
            </button>
          );
        })}
      </div>

      {/* Scenario blurb */}
      <div style={{ padding: "18px 22px", backgroundColor: CLR.szSurface, border: `1px solid ${CLR.szBorder}`, borderRadius: "4px", marginBottom: "18px", fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.6 }}>
        {aSc.szPlain}
      </div>

      {/* Canvas + side panel */}
      <div style={{ display: "grid", gridTemplateColumns: bMobile ? "1fr" : "minmax(0, 2fr) minmax(0, 1fr)", gap: bMobile ? "14px" : "20px" }}>
        {/* SVG canvas */}
        <div style={{ padding: bMobile ? "12px" : "20px", border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szCard, borderRadius: "4px", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <svg viewBox={`0 0 ${W} ${H}`} width={bMobile ? W : "100%"} style={{ display: "block", maxHeight: bMobile ? "none" : "360px", minWidth: bMobile ? `${W}px` : "auto" }}>
            <defs>
              <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={CLR.szRed} />
              </marker>
              <marker id="arrowhead-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={CLR.szBorder} />
              </marker>
            </defs>

            {/* faint baseline edges (full topology of this scenario) */}
            {aSc.vSteps.flatMap((s) => s.vEdges).map((e, i) => {
              const src = aSc.vNodes.find((n) => n.szId === e[0]);
              const dst = aSc.vNodes.find((n) => n.szId === e[1]);
              if (!src || !dst) return null;
              const x1 = src.fX + src.iW / 2, y1 = src.fY + 30;
              const x2 = dst.fX + dst.iW / 2, y2 = dst.fY + 30;
              return <line key={`base-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={CLR.szBorder} strokeWidth="1" opacity="0.35" strokeDasharray="3,3" />;
            })}

            {/* active edges for current step */}
            {aStep.vEdges.map((e, i) => {
              const src = aSc.vNodes.find((n) => n.szId === e[0]);
              const dst = aSc.vNodes.find((n) => n.szId === e[1]);
              if (!src || !dst) return null;
              const x1 = src.fX + src.iW / 2, y1 = src.fY + 30;
              const x2 = dst.fX + dst.iW / 2, y2 = dst.fY + 30;
              const fMidX = (x1 + x2) / 2, fMidY = (y1 + y2) / 2;
              return (
                <g key={`active-${i}`}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={CLR.szRed} strokeWidth="2.5" markerEnd={src === dst ? undefined : "url(#arrowhead)"} />
                  {e[2] && (
                    <g>
                      <rect x={fMidX - 70} y={fMidY - 10} width="140" height="18" fill={CLR.szCard} stroke={CLR.szRed} strokeWidth="1" rx="2" />
                      <text x={fMidX} y={fMidY + 3} textAnchor="middle" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szRed}>{e[2]}</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* nodes */}
            {aSc.vNodes.map((n) => {
              const bActive = setActive.has(n.szId);
              return (
                <g key={n.szId}>
                  <rect x={n.fX} y={n.fY} width={n.iW} height="60" rx="4"
                    fill={bActive ? CLR.szRed : CLR.szCard}
                    stroke={bActive ? CLR.szRedDark : CLR.szBorder}
                    strokeWidth={bActive ? 2 : 1}
                    style={{ transition: "fill .3s, stroke .3s" }} />
                  <text x={n.fX + n.iW / 2} y={n.fY + 24} textAnchor="middle" fontSize="13" fontFamily="'Geist', system-ui, sans-serif" fontWeight="600" fill={bActive ? "#fff" : CLR.szTextPrimary}>{n.szLabel}</text>
                  <text x={n.fX + n.iW / 2} y={n.fY + 44} textAnchor="middle" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={bActive ? "rgba(255,255,255,0.85)" : CLR.szTextDim}>{n.szSub}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Step description + controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ padding: "20px", border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szCard, borderRadius: "4px", flex: 1 }}>
            <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szRed, letterSpacing: "1.5px", marginBottom: "8px" }}>STEP {iStep + 1} / {aSc.vSteps.length}</div>
            <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "18px", fontWeight: 600, color: CLR.szTextPrimary, marginBottom: "12px", lineHeight: 1.3 }}>{aStep.szTitle}</div>
            <div style={{ fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.65 }}>{aStep.szBody}</div>
            {aStep.vActive.length > 0 && (
              <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: `1px solid ${CLR.szBorder}` }}>
                <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "1.5px", marginBottom: "6px" }}>ACTIVE NOW</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {aStep.vActive.map((id) => {
                    const n = aSc.vNodes.find((x) => x.szId === id);
                    if (!n) return null;
                    return <span key={id} style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", padding: "4px 8px", backgroundColor: CLR.szRed, color: "#fff", borderRadius: "2px", letterSpacing: "0.5px" }}>{n.szLabel}</span>;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Step dots */}
          <div style={{ padding: "12px 16px", border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szCard, borderRadius: "4px" }}>
            <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
              {aSc.vSteps.map((_, i) => (
                <button key={i} onClick={() => { setStep(i); setAuto(false); }}
                  style={{ width: "28px", height: "28px", border: `1px solid ${i === iStep ? CLR.szRed : CLR.szBorder}`, backgroundColor: i === iStep ? CLR.szRed : CLR.szCard, color: i === iStep ? "#fff" : CLR.szTextSecondary, borderRadius: "3px", cursor: "pointer", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px" }}>
                  {i + 1}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => { setStep((x) => Math.max(0, x - 1)); setAuto(false); }} disabled={iStep === 0}
                style={{ flex: 1, padding: "8px", border: `1px solid ${CLR.szBorder}`, backgroundColor: iStep === 0 ? CLR.szSurface : CLR.szCard, color: iStep === 0 ? CLR.szTextDim : CLR.szTextPrimary, borderRadius: "3px", cursor: iStep === 0 ? "not-allowed" : "pointer", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "1px" }}>
                ← PREV
              </button>
              <button onClick={() => setAuto((b) => !b)}
                style={{ flex: 1, padding: "8px", border: `1px solid ${bAuto ? CLR.szRed : CLR.szBorder}`, backgroundColor: bAuto ? CLR.szRed : CLR.szCard, color: bAuto ? "#fff" : CLR.szTextPrimary, borderRadius: "3px", cursor: "pointer", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "1px" }}>
                {bAuto ? "■ STOP" : "▶ AUTO"}
              </button>
              <button onClick={() => { setStep((x) => Math.min(aSc.vSteps.length - 1, x + 1)); setAuto(false); }} disabled={iStep === aSc.vSteps.length - 1}
                style={{ flex: 1, padding: "8px", border: `1px solid ${CLR.szRed}`, backgroundColor: iStep === aSc.vSteps.length - 1 ? CLR.szSurface : CLR.szRed, color: iStep === aSc.vSteps.length - 1 ? CLR.szTextDim : "#fff", borderRadius: "3px", cursor: iStep === aSc.vSteps.length - 1 ? "not-allowed" : "pointer", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "1px" }}>
                NEXT →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- PROCESS SPAWN WALKTHROUGH -------------------------------------------

function AstraProcessFlow() {
  const [iStep, setStep] = useState(0);
  const a = SPAWN_STEPS[iStep];
  return (
    <section id="astra-flow" style={{ ...SX_SECTION_PADDING }}>
      <Reveal>
        <div style={SX_LABEL}>step-through · 6 steps</div>
        <h2 style={SX_H2}>How Astra spawns a sandbox — without a kernel patch.</h2>
        <p style={SX_LEAD}>
          This is the single most important integration in the runtime: M-01 (Core) calls into M-02 (Isolation) through a hook chain right between fork and exec. Click through to see exactly what runs, in order.
        </p>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)", gap: "24px" }}>
        <div style={{ padding: "20px", backgroundColor: CLR.szCard, border: `1px solid ${CLR.szBorder}`, borderRadius: "4px" }}>
          {SPAWN_STEPS.map((s, i) => {
            const bActive = i === iStep;
            return (
              <button key={s.iIdx} onClick={() => setStep(i)}
                style={{ cursor: "pointer", display: "block", width: "100%", textAlign: "left", padding: "12px 14px", marginBottom: "6px", border: `1px solid ${bActive ? CLR.szRed : CLR.szBorder}`, backgroundColor: bActive ? CLR.szRed : CLR.szCard, color: bActive ? "#fff" : CLR.szTextPrimary, borderRadius: "3px", fontSize: "14px", fontFamily: "'Geist', system-ui, sans-serif" }}>
                <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "1px", color: bActive ? "rgba(255,255,255,0.7)" : CLR.szTextDim, marginRight: "10px" }}>0{s.iIdx}</span>
                {s.szTitle.replace(/^\d+\.\s*/, "")}
              </button>
            );
          })}
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <button disabled={iStep === 0} onClick={() => setStep((x) => Math.max(0, x - 1))} style={{ flex: 1, padding: "10px", border: `1px solid ${CLR.szBorder}`, backgroundColor: iStep === 0 ? CLR.szSurface : CLR.szCard, color: iStep === 0 ? CLR.szTextDim : CLR.szTextPrimary, borderRadius: "3px", cursor: iStep === 0 ? "not-allowed" : "pointer", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "1px" }}>← PREV</button>
            <button disabled={iStep === SPAWN_STEPS.length - 1} onClick={() => setStep((x) => Math.min(SPAWN_STEPS.length - 1, x + 1))} style={{ flex: 1, padding: "10px", border: `1px solid ${CLR.szRed}`, backgroundColor: iStep === SPAWN_STEPS.length - 1 ? CLR.szSurface : CLR.szRed, color: iStep === SPAWN_STEPS.length - 1 ? CLR.szTextDim : "#fff", borderRadius: "3px", cursor: iStep === SPAWN_STEPS.length - 1 ? "not-allowed" : "pointer", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "1px" }}>NEXT →</button>
          </div>
        </div>
        <div style={{ padding: "32px", backgroundColor: CLR.szCard, border: `1px solid ${CLR.szBorder}`, borderRadius: "4px" }}>
          <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szRed, letterSpacing: "1.5px" }}>STEP {a.iIdx} OF {SPAWN_STEPS.length}</div>
          <h3 style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "26px", fontWeight: 600, color: CLR.szTextPrimary, margin: "8px 0 18px", lineHeight: 1.2 }}>{a.szTitle}</h3>
          <div style={{ fontSize: "15px", color: CLR.szTextSecondary, lineHeight: 1.7 }}>{a.szBody}</div>
          <div style={{ marginTop: "28px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px", backgroundColor: CLR.szSurface, borderRadius: "3px", flexWrap: "wrap", gap: "12px" }}>
            <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "12px", color: CLR.szTextPrimary, padding: "8px 12px", backgroundColor: CLR.szCard, borderRadius: "3px", border: `1px solid ${CLR.szBorder}` }}>{a.szLeft}</span>
            <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szRed, letterSpacing: "0.5px" }}>──── {a.szArrow} ────▶</span>
            <span style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "12px", color: CLR.szTextPrimary, padding: "8px 12px", backgroundColor: CLR.szCard, borderRadius: "3px", border: `1px solid ${CLR.szBorder}` }}>{a.szRight}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- ZERO-COPY IPC DEEP DIVE ---------------------------------------------
//
// Six tabs. Each one explains a different layer of how the IPC engine works,
// with its own diagram. This is the project's flagship feature so it gets
// proper screen real estate.
// -------------------------------------------------------------------------

const IPC_TABS = [
  { szId: "problem", szTab: "1. The naive way",       szTitle: "Why traditional IPC is slow" },
  { szId: "memfd",   szTab: "2. memfd + mmap",        szTitle: "One piece of memory, two processes" },
  { szId: "layout",  szTab: "3. Memory layout",       szTitle: "Three cache lines + the ring" },
  { szId: "mpsc",    szTab: "4. MPSC claim/commit",   szTitle: "How multiple producers don't trip over each other" },
  { szId: "futex",   szTab: "5. Sleep until needed",  szTitle: "Blocking reads without burning CPU" },
  { szId: "cap",     szTab: "6. Capability gating (planned)", szTitle: "Capability validation on the hot path — planned" },
];

function AstraIpcDeepDive() {
  const { bMobile } = useViewport();
  const [szTab, setTab] = useState("problem");
  const [iTick, setTick] = useState(0);

  // animation tick for the MPSC and ring panels
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 100), 600);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="astra-ipc" style={{ ...sxSectionPadding(bMobile) }}>
      <Reveal>
        <div style={SX_LABEL}>flagship feature · zero-copy ipc · m-03</div>
        <h2 style={SX_H2}>How a message gets from Service A to Service B in under a microsecond.</h2>
        <p style={SX_LEAD}>
          Most IPC mechanisms copy your data three or four times before the receiver sees it. Astra's IPC copies it zero times — the two processes share the same physical memory pages. But sharing memory between sandboxes is dangerous, so every send and every receive is gated by a constant-time capability check. Below, the six layers of how that works.
        </p>
      </Reveal>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
        {IPC_TABS.map((t) => {
          const bActive = t.szId === szTab;
          return (
            <button key={t.szId} onClick={() => setTab(t.szId)}
              style={{ cursor: "pointer", padding: "10px 14px", border: `1px solid ${bActive ? CLR.szRed : CLR.szBorder}`, backgroundColor: bActive ? CLR.szRed : CLR.szCard, color: bActive ? "#fff" : CLR.szTextPrimary, borderRadius: "3px", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.5px" }}>
              {t.szTab}
            </button>
          );
        })}
      </div>

      <div style={{ padding: bMobile ? "20px" : "30px", border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szCard, borderRadius: "4px" }}>
        <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: bMobile ? "18px" : "22px", fontWeight: 600, color: CLR.szTextPrimary, marginBottom: "16px" }}>
          {IPC_TABS.find((t) => t.szId === szTab).szTitle}
        </div>

        {szTab === "problem" && <IpcPanelProblem bMobile={bMobile} />}
        {szTab === "memfd"   && <IpcPanelMemfd bMobile={bMobile} />}
        {szTab === "layout"  && <IpcPanelLayout bMobile={bMobile} />}
        {szTab === "mpsc"    && <IpcPanelMpsc iTick={iTick} bMobile={bMobile} />}
        {szTab === "futex"   && <IpcPanelFutex bMobile={bMobile} />}
        {szTab === "cap"     && <IpcPanelCap bMobile={bMobile} />}
      </div>
    </section>
  );
}

// Panel 1: the problem
function IpcPanelProblem({ bMobile }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: bMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: bMobile ? "20px" : "30px", alignItems: "start" }}>
      <div>
        <p style={{ fontSize: "15px", color: CLR.szTextSecondary, lineHeight: 1.7, marginBottom: "16px" }}>
          A typical IPC send (Unix socket, pipe, dbus) traverses kernel buffers and copies your bytes <strong>three or four times</strong> before the receiver gets them. Each copy:
        </p>
        <ul style={{ fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.8, paddingLeft: "20px", marginBottom: "16px" }}>
          <li>burns CPU cycles for the memcpy itself,</li>
          <li>pollutes the L1 cache with bytes you'll discard,</li>
          <li>incurs at least one syscall (user/kernel boundary cross).</li>
        </ul>
        <p style={{ fontSize: "15px", color: CLR.szTextSecondary, lineHeight: 1.7 }}>
          For sub-microsecond message delivery, you literally cannot afford any of that. The only way to hit the latency target is to <strong>not copy at all</strong>.
        </p>
      </div>
      <div>
        <svg viewBox="0 0 400 220" style={{ width: "100%", maxWidth: "480px" }}>
          {/* boxes */}
          {[
            { x: 0,   y: 30,  szLbl: "Producer\nbuffer" },
            { x: 100, y: 30,  szLbl: "Kernel\nsend buffer" },
            { x: 200, y: 30,  szLbl: "Kernel\nrecv buffer" },
            { x: 300, y: 30,  szLbl: "Consumer\nbuffer" },
          ].map((b) => (
            <g key={b.x}>
              <rect x={b.x + 10} y={b.y} width="80" height="60" fill={CLR.szSurface} stroke={CLR.szBorder} rx="3" />
              {b.szLbl.split("\n").map((line, i) => (
                <text key={i} x={b.x + 50} y={b.y + 28 + i * 14} textAnchor="middle" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fontSize="10" fill={CLR.szTextSecondary}>{line}</text>
              ))}
            </g>
          ))}
          {/* arrows with copy labels */}
          {[0, 100, 200].map((x) => (
            <g key={x}>
              <line x1={x + 90} y1={60} x2={x + 110} y2={60} stroke={CLR.szRed} strokeWidth="1.5" markerEnd="url(#ipc-arrow)" />
              <text x={x + 100} y={50} textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szRed}>copy</text>
            </g>
          ))}
          <defs>
            <marker id="ipc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={CLR.szRed} />
            </marker>
          </defs>
          <text x="200" y="130" textAnchor="middle" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fontSize="11" fill={CLR.szTextDim}>3 copies + 2 syscalls</text>
          <text x="200" y="160" textAnchor="middle" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fontSize="13" fill={CLR.szRed} fontWeight="600">~ 2-5 µs latency</text>
        </svg>
      </div>
    </div>
  );
}

// Panel 2: memfd
function IpcPanelMemfd({ bMobile }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: bMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: bMobile ? "20px" : "30px", alignItems: "start" }}>
      <div>
        <p style={{ fontSize: "15px", color: CLR.szTextSecondary, lineHeight: 1.7, marginBottom: "12px" }}>
          Astra's M-03 IPC creates the channel <strong>once</strong>, in three syscalls:
        </p>
        <pre style={{ background: CLR.szSurface, border: `1px solid ${CLR.szBorder}`, borderRadius: "3px", padding: "14px 16px", fontSize: "12px", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", color: CLR.szTextPrimary, overflowX: "auto", marginBottom: "16px" }}>
{`int fd = memfd_create("astra-ipc", MFD_CLOEXEC);
ftruncate(fd, 2 * 1024 * 1024);   // 2 MiB
void* base = mmap(nullptr, size,
                  PROT_READ | PROT_WRITE,
                  MAP_SHARED, fd, 0);`}
        </pre>
        <p style={{ fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.7, marginBottom: "10px" }}>
          <strong>memfd_create</strong> gives you a file descriptor backed by RAM, not disk. Pass that fd over a Unix socket (SCM_RIGHTS) to the other process. Both processes <strong>mmap the same fd</strong>. From that point on, both ends of the channel see the same physical pages.
        </p>
        <p style={{ fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.7 }}>
          A write by Service A is a write by Service B. There is no copy because there's only one piece of memory.
        </p>
      </div>
      <div>
        <svg viewBox="0 0 400 240" style={{ width: "100%", maxWidth: "480px" }}>
          {/* shared memory in middle */}
          <rect x="120" y="80" width="160" height="80" fill={CLR.szRed} rx="4" />
          <text x="200" y="115" textAnchor="middle" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fontSize="11" fill="#fff">shared physical pages</text>
          <text x="200" y="135" textAnchor="middle" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fontSize="10" fill="rgba(255,255,255,0.8)">(memfd + mmap)</text>
          {/* Service A */}
          <rect x="0" y="40" width="100" height="50" fill={CLR.szCard} stroke={CLR.szBorder} rx="3" />
          <text x="50" y="60" textAnchor="middle" fontSize="11" fontFamily="'Geist', sans-serif" fontWeight="600" fill={CLR.szTextPrimary}>Service A</text>
          <text x="50" y="78" textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim}>own VA</text>
          <line x1="100" y1="65" x2="120" y2="100" stroke={CLR.szRed} strokeWidth="1.5" />
          <text x="105" y="92" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szRed}>mmap</text>
          {/* Service B */}
          <rect x="300" y="40" width="100" height="50" fill={CLR.szCard} stroke={CLR.szBorder} rx="3" />
          <text x="350" y="60" textAnchor="middle" fontSize="11" fontFamily="'Geist', sans-serif" fontWeight="600" fill={CLR.szTextPrimary}>Service B</text>
          <text x="350" y="78" textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim}>own VA</text>
          <line x1="300" y1="65" x2="280" y2="100" stroke={CLR.szRed} strokeWidth="1.5" />
          <text x="285" y="92" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szRed}>mmap</text>
          {/* count */}
          <text x="200" y="200" textAnchor="middle" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fontSize="11" fill={CLR.szTextDim}>0 copies, 0 syscalls per message</text>
          <text x="200" y="222" textAnchor="middle" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fontSize="13" fill={CLR.szGreen} fontWeight="600">~ 100-200 ns latency</text>
        </svg>
      </div>
    </div>
  );
}

// Panel 3: memory layout
function IpcPanelLayout({ bMobile }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: bMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1.2fr)", gap: bMobile ? "20px" : "30px", alignItems: "start" }}>
      <div>
        <p style={{ fontSize: "15px", color: CLR.szTextSecondary, lineHeight: 1.7, marginBottom: "12px" }}>
          The shared region opens with a <strong>3-cache-line control block</strong>, then the ring data area.
        </p>
        <p style={{ fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.7, marginBottom: "10px" }}>
          Why three separate cache lines? <strong>False sharing</strong>. If write_index lived in the same 64-byte cache line as read_index, every producer write would invalidate the reader's L1 cache line on a different core, costing 50-100 ns per message. By separating them, the writer's CPU and the reader's CPU each keep their hot index pinned in their own L1.
        </p>
        <p style={{ fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.7 }}>
          A C++ <code style={{ background: CLR.szSurface, padding: "1px 4px", borderRadius: "2px", fontSize: "12px" }}>static_assert(sizeof(ChannelControlBlock) == 3 * 64)</code> stops anyone from ever breaking this layout by accident.
        </p>
      </div>
      <div>
        <svg viewBox="0 0 460 280" style={{ width: "100%", maxWidth: "560px" }}>
          {/* CL 1 - writer */}
          <rect x="0" y="20" width="200" height="60" fill={CLR.szRed} rx="3" />
          <text x="100" y="42" textAnchor="middle" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill="#fff" fontWeight="600">cache line 1 — writer</text>
          <text x="100" y="58" textAnchor="middle" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill="rgba(255,255,255,0.85)">m_uWriteIndex</text>
          <text x="100" y="72" textAnchor="middle" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill="rgba(255,255,255,0.85)">m_uWriteClaimIndex</text>
          <text x="220" y="55" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim}>← writer's CPU keeps this hot</text>

          {/* CL 2 - reader */}
          <rect x="0" y="100" width="200" height="60" fill={CLR.szTextPrimary} rx="3" />
          <text x="100" y="122" textAnchor="middle" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill="#fff" fontWeight="600">cache line 2 — reader</text>
          <text x="100" y="142" textAnchor="middle" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill="rgba(255,255,255,0.85)">m_uReadIndex</text>
          <text x="220" y="135" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim}>← reader's CPU keeps this hot</text>

          {/* CL 3 - meta */}
          <rect x="0" y="180" width="200" height="60" fill={CLR.szTextSecondary} rx="3" />
          <text x="100" y="202" textAnchor="middle" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill="#fff" fontWeight="600">cache line 3 — metadata</text>
          <text x="100" y="218" textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill="rgba(255,255,255,0.85)">channel id, byte sizes</text>
          <text x="100" y="232" textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill="rgba(255,255,255,0.85)">(set once at create)</text>
          <text x="220" y="215" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim}>← read-only after init</text>

          {/* total */}
          <line x1="0" y1="260" x2="460" y2="260" stroke={CLR.szBorder} />
          <text x="0" y="276" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim}>then: 2 MiB ring data</text>
        </svg>
      </div>
    </div>
  );
}

// Panel 4: MPSC claim/commit
function IpcPanelMpsc({ iTick, bMobile }) {
  // animate two producers racing
  const iPhase = iTick % 6;
  return (
    <div>
      <p style={{ fontSize: "15px", color: CLR.szTextSecondary, lineHeight: 1.7, marginBottom: "20px", maxWidth: "780px" }}>
        Multiple services can produce on the same channel concurrently. Astra splits the write path by message size: <strong>≤ 256 B uses a wait-free fetch_add</strong> (one atomic, no retries), <strong>&gt; 256 B uses a lock-free CAS loop</strong>. Both protocols guarantee the reader sees a contiguous, ordered byte stream.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: bMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: bMobile ? "16px" : "24px" }}>
        {/* Small message path */}
        <div style={{ padding: "18px", border: `1px solid ${CLR.szBorder}`, borderRadius: "3px", backgroundColor: CLR.szSurface }}>
          <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szRed, letterSpacing: "1.5px", marginBottom: "8px" }}>WAIT-FREE · ≤ 256 B</div>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: "16px", fontWeight: 600, color: CLR.szTextPrimary, marginBottom: "10px" }}>Single fetch_add</div>
          <ol style={{ fontSize: "13px", color: CLR.szTextSecondary, lineHeight: 1.7, paddingLeft: "20px", margin: 0 }}>
            <li><strong>Pre-check:</strong> read claim_index and read_index, ensure room.</li>
            <li><strong>Claim:</strong> <code style={{ background: CLR.szCard, padding: "1px 4px", borderRadius: "2px", fontSize: "11px" }}>fetch_add(claim, total)</code> — one CPU instruction, returns my offset.</li>
            <li><strong>Verify:</strong> if my offset+total &gt; ring size, write a SKIP sentinel (the reader silently consumes it) and bail.</li>
            <li><strong>Write:</strong> memcpy header + payload into my claimed slot. No atomic.</li>
            <li><strong>Commit:</strong> spin-CAS write_index from my offset to my offset+total. This serialises with any earlier producer.</li>
          </ol>
        </div>

        {/* Large message path */}
        <div style={{ padding: "18px", border: `1px solid ${CLR.szBorder}`, borderRadius: "3px", backgroundColor: CLR.szSurface }}>
          <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szRed, letterSpacing: "1.5px", marginBottom: "8px" }}>LOCK-FREE · &gt; 256 B</div>
          <div style={{ fontFamily: "'Geist', sans-serif", fontSize: "16px", fontWeight: 600, color: CLR.szTextPrimary, marginBottom: "10px" }}>CAS retry loop</div>
          <ol style={{ fontSize: "13px", color: CLR.szTextSecondary, lineHeight: 1.7, paddingLeft: "20px", margin: 0 }}>
            <li>Snapshot claim_index.</li>
            <li>Read read_index, compute free space.</li>
            <li>If full → fail with RESOURCE_EXHAUSTED, no SKIP record needed.</li>
            <li><strong>CAS</strong> claim_index from snapshot to snapshot+total.</li>
            <li>If CAS fails (another producer beat me) → retry from step 1.</li>
            <li>If CAS wins → write data, then spin-CAS commit (same as above).</li>
          </ol>
        </div>
      </div>

      {/* Animated dual-producer */}
      <div style={{ marginTop: "26px", padding: "20px", border: `1px solid ${CLR.szBorder}`, borderRadius: "3px", backgroundColor: CLR.szCard }}>
        <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: CLR.szTextDim, letterSpacing: "1.5px", marginBottom: "12px" }}>LIVE · TWO PRODUCERS RACING ON THE SMALL-MESSAGE PATH</div>
        <svg viewBox="0 0 700 130" style={{ width: "100%", maxWidth: "780px" }}>
          {/* ring 8 slots */}
          {Array.from({ length: 8 }).map((_, i) => {
            const x = 60 + i * 70;
            const aWritten = (iPhase >= 4 && i === 4) || (iPhase >= 5 && i === 5);
            const aClaimedA = iPhase >= 1 && i === 4;
            const aClaimedB = iPhase >= 2 && i === 5;
            return (
              <g key={i}>
                <rect x={x} y="40" width="60" height="40"
                  fill={aWritten ? CLR.szTextPrimary : (aClaimedA ? CLR.szRed : (aClaimedB ? CLR.szRedDark : CLR.szSurface))}
                  stroke={CLR.szBorder} rx="3" />
                <text x={x + 30} y="64" textAnchor="middle" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={aWritten || aClaimedA || aClaimedB ? "#fff" : CLR.szTextDim}>
                  {aWritten ? "msg" : aClaimedA ? "A claim" : aClaimedB ? "B claim" : "free"}
                </text>
              </g>
            );
          })}
          {/* labels */}
          <text x="0" y="30" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szRed}>P1</text>
          <text x="0" y="100" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szRedDark}>P2</text>
          <text x="60" y="115" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim}>
            {iPhase === 0 && "both producers see free space, race to fetch_add..."}
            {iPhase === 1 && "P1 wins fetch_add, claims slot 4 (wait-free)"}
            {iPhase === 2 && "P2 fetch_add returns slot 5 — serialised by the atomic"}
            {iPhase === 3 && "both write payload into their own claimed slots — no contention"}
            {iPhase === 4 && "P1 commits write_index → slot 4 visible to reader"}
            {iPhase === 5 && "P2 spin-CAS waits for P1, then commits → both visible, in order"}
          </text>
        </svg>
      </div>
    </div>
  );
}

// Panel 5: futex
function IpcPanelFutex({ bMobile }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: bMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: bMobile ? "20px" : "30px", alignItems: "start" }}>
      <div>
        <p style={{ fontSize: "15px", color: CLR.szTextSecondary, lineHeight: 1.7, marginBottom: "12px" }}>
          A consumer that's always polling burns 100% of a CPU core for nothing. A consumer that <code style={{ background: CLR.szSurface, padding: "1px 4px", borderRadius: "2px", fontSize: "12px" }}>sleep(1ms)</code>s adds 1 ms to every message latency.
        </p>
        <p style={{ fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.7, marginBottom: "12px" }}>
          Astra's reader uses C++20 <code style={{ background: CLR.szSurface, padding: "1px 4px", borderRadius: "2px", fontSize: "12px" }}>atomic.wait()</code>, which on Linux compiles to a <strong>futex SYS_FUTEX_WAIT</strong> syscall. The reader thread parks in the kernel scheduler with zero CPU usage. When the producer commits a message, it calls <code style={{ background: CLR.szSurface, padding: "1px 4px", borderRadius: "2px", fontSize: "12px" }}>notify_one()</code> which compiles to <strong>SYS_FUTEX_WAKE</strong>.
        </p>
        <p style={{ fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.7 }}>
          End-to-end wake latency: a few microseconds. CPU cost while idle: zero.
        </p>
      </div>
      <div>
        <svg viewBox="0 0 400 240" style={{ width: "100%", maxWidth: "480px" }}>
          {/* timeline lines */}
          <line x1="20" y1="40" x2="380" y2="40" stroke={CLR.szBorder} />
          <line x1="20" y1="120" x2="380" y2="120" stroke={CLR.szBorder} />
          <line x1="20" y1="200" x2="380" y2="200" stroke={CLR.szBorder} />
          <text x="0" y="44" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim}>writer</text>
          <text x="0" y="124" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim}>kernel</text>
          <text x="0" y="204" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim}>reader</text>

          {/* events */}
          <circle cx="80" cy="200" r="6" fill={CLR.szRed} />
          <text x="80" y="225" textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextSecondary}>readWait()</text>
          <line x1="80" y1="200" x2="180" y2="120" stroke={CLR.szRed} strokeDasharray="3,3" />
          <text x="125" y="170" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szRed}>FUTEX_WAIT</text>
          <rect x="180" y="115" width="120" height="10" fill={CLR.szTextSecondary} />
          <text x="240" y="108" textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim}>reader sleeps · 0% CPU</text>

          <circle cx="280" cy="40" r="6" fill={CLR.szRed} />
          <text x="280" y="25" textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextSecondary}>writeNotify()</text>
          <line x1="280" y1="40" x2="300" y2="120" stroke={CLR.szRed} strokeDasharray="3,3" />
          <text x="305" y="80" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szRed}>FUTEX_WAKE</text>

          <line x1="300" y1="120" x2="340" y2="200" stroke={CLR.szRed} />
          <circle cx="340" cy="200" r="6" fill={CLR.szRed} />
          <text x="340" y="225" textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextSecondary}>woken, reads</text>
        </svg>
      </div>
    </div>
  );
}

// Panel 6: capability gate (PLANNED — not yet wired into IPC)
function IpcPanelCap({ bMobile }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: bMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: bMobile ? "20px" : "30px", alignItems: "start" }}>
      <div>
        <div style={{ display: "inline-block", padding: "4px 10px", backgroundColor: CLR.szAmber, color: "#fff", borderRadius: "3px", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "1.5px", marginBottom: "12px" }}>PLANNED · NOT YET WIRED</div>
        <p style={{ fontSize: "15px", color: CLR.szTextSecondary, lineHeight: 1.7, marginBottom: "12px" }}>
          Sharing memory between sandboxes is dangerous. The plan — and the central novelty claim of Paper 1 — is to gate every send and every receive with a capability check <strong>before</strong> the atomic operations. Today the M-03 RingBuffer's write() and read() do <strong>not</strong> yet take a CapToken parameter; integration with M-01's CapabilityManager is the next sprint. The capability infrastructure itself already exists (token pool, derive, revoke, IPC_SEND / IPC_RECV permission bits) — only the wiring is missing.
        </p>
        <pre style={{ background: CLR.szSurface, border: `1px solid ${CLR.szBorder}`, borderRadius: "3px", padding: "14px 16px", fontSize: "12px", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", color: CLR.szTextPrimary, overflowX: "auto", marginBottom: "16px" }}>
{`// planned signature for the next sprint:
Status RingBuffer::write(const void* data,
                         U32 len,
                         const CapToken& tok) {
    if (!caps.validate(tok, IPC_SEND))
        return Error{CAPABILITY_INVALID};
    // ... fetch_add, write, commit ...
}`}
        </pre>
        <p style={{ fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.7 }}>
          The <code style={{ background: CLR.szSurface, padding: "1px 4px", borderRadius: "2px", fontSize: "12px" }}>validate()</code> call walks the active token table comparing epoch + permission bits. With the default 4096-token pool, that's a small linear scan; the planned optimisation is a hash-indexed fast path so the validate cost stays well under the IPC fast-path budget. Once revoke() bumps a token's epoch, every future validate against descendants of that token fails — that's the O(1) cascading-revocation property the comparison table claims.
        </p>
      </div>
      <div>
        <svg viewBox="0 0 400 280" style={{ width: "100%", maxWidth: "480px" }}>
          {/* Token */}
          <rect x="20" y="20" width="160" height="100" fill={CLR.szSurface} stroke={CLR.szBorder} rx="4" />
          <text x="100" y="40" textAnchor="middle" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fontWeight="600" fill={CLR.szTextPrimary}>capability token</text>
          <text x="30" y="60" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextSecondary}>uid: 0xABCD…</text>
          <text x="30" y="76" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextSecondary}>epoch: 42</text>
          <text x="30" y="92" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextSecondary}>perms: IPC_SEND |</text>
          <text x="42" y="106" fontSize="10" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextSecondary}>IPC_RECV</text>

          {/* Validate */}
          <rect x="220" y="20" width="160" height="100" fill={CLR.szRed} rx="4" />
          <text x="300" y="40" textAnchor="middle" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fontWeight="600" fill="#fff">validate()</text>
          <text x="300" y="60" textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill="rgba(255,255,255,0.9)">tok.epoch == reg.epoch?</text>
          <text x="300" y="76" textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill="rgba(255,255,255,0.9)">tok.perms & required ?</text>
          <text x="300" y="100" textAnchor="middle" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fontWeight="600" fill="#fff">~10 ns</text>

          <line x1="180" y1="70" x2="220" y2="70" stroke={CLR.szRed} strokeWidth="2" markerEnd="url(#cap-arrow)" />
          <defs>
            <marker id="cap-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={CLR.szRed} />
            </marker>
          </defs>

          {/* outcomes */}
          <rect x="220" y="160" width="75" height="40" fill={CLR.szGreen} rx="3" />
          <text x="257" y="184" textAnchor="middle" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fontWeight="600" fill="#fff">PASS</text>
          <text x="257" y="218" textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextSecondary}>proceed to fetch_add</text>

          <rect x="305" y="160" width="75" height="40" fill={CLR.szRedDark} rx="3" />
          <text x="342" y="184" textAnchor="middle" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fontWeight="600" fill="#fff">FAIL</text>
          <text x="342" y="218" textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextSecondary}>send rejected</text>

          <text x="200" y="260" textAnchor="middle" fontSize="11" fontFamily="'Geist Mono', 'JetBrains Mono', monospace" fill={CLR.szTextDim}>revoke(token) → epoch++ → every future send fails. O(1).</text>
        </svg>
      </div>
    </div>
  );
}

// ---- COMPARISON TABLE ----------------------------------------------------

function AstraComparison() {
  const { bMobile } = useViewport();
  const fnRender = (m) => {
    if (m === "yes") return <span style={{ color: CLR.szGreen, fontWeight: 700 }}>YES</span>;
    if (m === "no") return <span style={{ color: CLR.szTextDim }}>—</span>;
    if (m === "partial") return <span style={{ color: CLR.szAmber, fontWeight: 600 }}>PARTIAL</span>;
    if (m === "kernel") return <span style={{ color: CLR.szTextDim, fontSize: "11px", fontStyle: "italic" }}>(in-kernel)</span>;
    if (m === "via-svc") return <span style={{ color: CLR.szTextDim, fontSize: "11px", fontStyle: "italic" }}>(via msg-passing)</span>;
    if (m === "via-vsock") return <span style={{ color: CLR.szTextDim, fontSize: "11px", fontStyle: "italic" }}>(via vsock)</span>;
    return m;
  };
  return (
    <section style={{ ...sxSectionPadding(bMobile) }}>
      <Reveal>
        <div style={SX_LABEL}>vs the field</div>
        <h2 style={SX_H2}>Where Astra sits in the landscape.</h2>
        <p style={SX_LEAD}>
          Honest read against the closest competitors. Astra wins on the unique combination of capability tokens + zero-copy IPC + O(1) revocation on stock Linux. It loses on hardware-virt isolation strength (Firecracker) and proof depth (seL4) — and that's fine; those are different bets.
        </p>
      </Reveal>
      <div style={{ overflowX: "auto", border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szCard, borderRadius: "4px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "640px" }}>
          <thead>
            <tr style={{ backgroundColor: CLR.szSurface }}>
              <th style={{ textAlign: "left", padding: "14px 18px", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "1.5px", color: CLR.szTextDim, fontWeight: 600 }}>FEATURE</th>
              {COMPARISON_HEADERS.map((h, i) => (
                <th key={h} style={{ textAlign: "center", padding: "14px 12px", fontFamily: "'Geist', system-ui, sans-serif", fontSize: "13px", color: i === 0 ? CLR.szRed : CLR.szTextSecondary, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row, i) => (
              <tr key={row.szFeature} style={{ borderTop: `1px solid ${CLR.szBorder}`, backgroundColor: i % 2 ? CLR.szCard : CLR.szCardHover }}>
                <td style={{ padding: "12px 18px", fontSize: "13px", color: CLR.szTextPrimary }}>{row.szFeature}</td>
                {row.vMark.map((m, j) => (
                  <td key={j} style={{ padding: "12px", textAlign: "center", fontSize: "12px", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", letterSpacing: "0.5px" }}>{fnRender(m)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---- ROADMAP -------------------------------------------------------------

function AstraRoadmap() {
  const { bMobile } = useViewport();
  return (
    <section style={{ ...sxSectionPadding(bMobile) }}>
      <Reveal>
        <div style={SX_LABEL}>the next 12 months</div>
        <h2 style={SX_H2}>From honest pitch to first top-tier publication.</h2>
        <p style={SX_LEAD}>
          A focused 5-paper plan replaces the original 14-paper sketch. Paper 1 (capability-gated zero-copy IPC) targets USENIX ATC 2027. The rest cite it.
        </p>
      </Reveal>
      <div style={{ position: "relative", paddingLeft: "32px" }}>
        <div style={{ position: "absolute", left: "10px", top: 0, bottom: 0, width: "2px", backgroundColor: CLR.szBorder }} />
        {ROADMAP.map((r, i) => (
          <Reveal key={r.szTitle} iDelay={i * 60}>
            <div style={{ position: "relative", paddingBottom: "28px" }}>
              <div style={{ position: "absolute", left: "-26px", top: "8px", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: r.szColor, border: `2px solid ${CLR.szCard}`, boxShadow: `0 0 0 1px ${r.szColor}` }} />
              <div style={{ padding: "18px 22px", border: `1px solid ${CLR.szBorder}`, backgroundColor: CLR.szCard, borderRadius: "4px" }}>
                <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "10px", color: r.szColor, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "4px" }}>{r.szWhen}</div>
                <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "18px", fontWeight: 600, color: CLR.szTextPrimary, marginBottom: "6px" }}>{r.szTitle}</div>
                <div style={{ fontSize: "14px", color: CLR.szTextSecondary, lineHeight: 1.6 }}>{r.szBody}</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---- CTA -----------------------------------------------------------------

function AstraCTA() {
  const { bMobile } = useViewport();
  return (
    <section style={{ ...sxSectionPadding(bMobile), paddingTop: bMobile ? "40px" : "60px", paddingBottom: bMobile ? "80px" : "120px" }}>
      <Reveal>
        <div style={{ padding: bMobile ? "40px 24px" : "60px 40px", backgroundColor: CLR.szTextPrimary, color: "#fff", borderRadius: "6px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "11px", color: CLR.szRedLight, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px" }}>read · clone · contribute</div>
          <h2 style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600, lineHeight: 1.15, marginBottom: "20px", maxWidth: "700px", marginLeft: "auto", marginRight: "auto" }}>
            All of this is open source. The code, the docs, the publication strategy.
          </h2>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.65)", lineHeight: 1.7, maxWidth: "640px", margin: "0 auto 32px" }}>
            Six modules ship today. Fifteen are reserved scaffolding with explicit "not built" READMEs. The 5-paper roadmap is in <code style={{ backgroundColor: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "3px", fontSize: "13px" }}>docs/PUBLICATION_STRATEGY.md</code>.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://github.com/KernelArch-Lab/Astra" target="_blank" rel="noreferrer" style={{ ...sxBtnPrimary }}>github.com/KernelArch-Lab/Astra →</a>
            <a href="https://github.com/KernelArch-Lab/Astra/blob/main/docs/PROJECT_GUIDE.md" target="_blank" rel="noreferrer" style={{ fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: "12px", padding: "12px 26px", backgroundColor: "transparent", color: "#fff", border: `1px solid rgba(255,255,255,0.3)`, borderRadius: "3px", textDecoration: "none", letterSpacing: "0.5px" }}>Project guide</a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ---- MAIN PAGE -----------------------------------------------------------

export default function AstraLanding() {
  const { bMobile } = useViewport();
  // Scroll to top on mount
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, []);
  return (
    <div style={{ position: "relative", backgroundColor: CLR.szBg, minHeight: "100vh" }}>
      <button onClick={() => { window.location.hash = "#/"; }}
        style={{ position: "fixed", top: bMobile ? "70px" : "100px", left: bMobile ? "12px" : "24px", zIndex: 50, background: CLR.szCard, border: `1px solid ${CLR.szBorder}`, cursor: "pointer", fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: bMobile ? "10px" : "11px", color: CLR.szTextSecondary, letterSpacing: "1px", padding: bMobile ? "6px 10px" : "8px 14px", borderRadius: "3px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        ← BACK
      </button>
      <AstraHero />
      <AstraProblem />
      <AstraLayerExplorer />
      <AstraConnectionMap />
      <AstraScenarioPlayer />
      <AstraIpcDeepDive />
      <AstraComparison />
      <AstraRoadmap />
      <AstraCTA />
    </div>
  );
}
