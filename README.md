# ludusavi-restic

## Requirements

- [Bun](https://bun.sh/)
- [Ludusavi](https://github.com/mtkennerly/ludusavi)
- [Restic](https://restic.net/)

## Usage

First, copy `.env.example` to `.env` and modify it.

```sh
# Backup all detected games with only Restic
backup

# Backup all detected games with both Ludusavi and Restic
backup -f

# Backup two games
# Note the game names are case-sensitive
backup "Minecraft: Java Edition" "Minecraft: Bedrock Edition"
```

## Special Thanks

Thanks to [Ludusavi Restic Playnite Plugin] for the inspiration!

[Ludusavi Restic Playnite Plugin]: https://github.com/sharkusmanch/playnite-ludusavi-restic
