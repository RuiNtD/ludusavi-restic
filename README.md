# ludusavi-restic

## Requirements

- [Deno](https://deno.com/)
- [Ludusavi](https://github.com/mtkennerly/ludusavi)
- [Restic](https://restic.net/)

## Usage

1. Copy `.env.example` to `.env` and modify it.
2. `backup`

- `backup -f` to also perform a full Ludusavi backup and
  back up the Ludusavi folder.
- `backup [Game...]` to backup specific games.

## Special Thanks

Thanks to [Ludusavi Restic Playnite Plugin] for the inspiration!

[Ludusavi Restic Playnite Plugin]: https://github.com/sharkusmanch/playnite-ludusavi-restic
