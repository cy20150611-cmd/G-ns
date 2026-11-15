# G-ns

GUN GAME — an online top-down multiplayer shooter that runs in the browser.

## Put it online

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/cy20150611-cmd/G-ns)

Click the button, sign in to Render with GitHub, and click **Deploy**. Render gives you a link to share with friends.

## Play locally

```bash
npm install
npm start
```

Open http://localhost:3000. Pick a game mode and a map in the menu. Bots fill every match up to 20 players (6 in Undead Horde).

## Controls

| Action | Key |
| --- | --- |
| Move | WASD |
| Look / aim | Mouse |
| Shoot | Left click |
| Aim down sights / sniper scope | Right click |
| Sprint | Shift |
| Jump | Space |
| Crouch (slide while sprinting) | C |
| Reload | R |
| Switch weapon | 1 / 2 or mouse wheel |
| Special (Medkit, Dash, Summon Undead) | Q |
| Scoreboard | Tab |
| Menu | Esc |

## Gun sets

Build your own sets in the **Gun Sets** tab: name it, pick a main gun (Assault Rifle, SMG, Shotgun, Sniper, LMG, DMR), a second weapon (Pistol, Revolver, Knife), a special (Medkit, Dash, Summon Undead) and a color. Make as many as you want. Shared sets can be found by anyone with **Search**.

Shared sets are stored in `data/sets.json` on the server (set `DATA_DIR` to change where). On Render's free plan that folder is wiped on every deploy.

## Game modes

Free For All, Team Deathmatch, King of the Hill, Gun Game, Infection, Undead Horde (co-op waves), One Shot, Snipers Only and Knife Fight.

## Maps

Yard, Desert Town, Neon City and Snow Forts.

## Gun models

Put `.glb` files in `public/models/guns/` to replace the built-in guns. See the README in that folder.

## How it works

- `server.js`: Node.js server. One room per mode + map. Checks every shot; runs health, kills, teams, modes, bots and the undead (path-finding on a grid); stores shared gun sets.
- `public/main.js`: menu, gun sets and the 3D first-person game in the browser, built with [three.js](https://threejs.org).
- `public/models.js`: 3D soldiers, undead, guns, first-person arms and their animations.
- `public/shared.js`: guns, gun sets, modes, maps and movement physics shared by server and browser.

Set `PORT` to use a different port.
