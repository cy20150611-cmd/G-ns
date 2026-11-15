# G-ns

GUN GAME — an online top-down multiplayer shooter that runs in the browser.

## Play locally

```bash
npm install
npm start
```

Open http://localhost:3000. Open it in several tabs, or on other devices on your network, to play against each other.

## Controls

| Action | Key |
| --- | --- |
| Move | WASD / arrow keys |
| Aim | Mouse |
| Shoot | Left click (hold for auto-fire) |

## How it works

- `server.js`: a Node.js server that serves the game and runs the authoritative simulation (movement, bullets, damage, kills, respawns) at 60 ticks/s, sending state to every player over WebSockets 30 times a second.
- `public/`: the browser client. It sends your inputs to the server and draws the arena with HTML canvas.

Set the `PORT` environment variable to use a different port.
