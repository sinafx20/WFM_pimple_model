# Claude project memory (snapshot)

These are a copy of Claude Code's project memory, committed so the project context
survives a machine switch (private repo). They are a **point-in-time snapshot** — the
live memory lives at `~/.claude/projects/<project>/memory/` on whatever machine you use.

## New machine? Do this first
1. Restore the keys — Claude will ask you for them, or run:
   `cp heygen-studio/.env.example heygen-studio/.env` then paste the 5 keys
   (HeyGen, HubSpot, logo.dev, Instantly, HeyReach). **Rotate any shared in chat.**
2. (Optional, for seamless Claude continuity) copy these files into the new machine's
   `~/.claude/projects/<project>/memory/` folder so Claude loads them as live memory.
   Otherwise just point Claude at this folder and ask it to rebuild context.

Start with `MEMORY.md` (the index), then `volcano-test-campaign.md` and `gtm-hub.md`
for the current active work. See `../../HANDOFF.md` for how to install and run.
