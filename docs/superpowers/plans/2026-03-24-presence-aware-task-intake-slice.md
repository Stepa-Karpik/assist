# Presence-Aware Task Intake Slice

1. Extend task intake responses with `device_online` where they already return a
   meaningful visible state.
2. Update bot workflow mapping so queued/auth-success copy can mention offline
   desktop state.
3. Add regression tests for offline and online queueing behavior.
4. Harden JSON state replace with retry-on-`PermissionError`.
5. Add persistence regression coverage for the transient replace failure path.
