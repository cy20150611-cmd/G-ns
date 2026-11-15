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

Open http://localhost:3000. Bots fill the game up to 20 players, so you always have someone to fight.

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
| Summon undead (Undead Summoner) | Q |
| Scoreboard | Tab |
| Menu / change name / change class | Esc |

## Classes

| Class | Weapons | Special |
| --- | --- | --- |
| Rifleman | Assault rifle + pistol | Good at every range |
| Close Combat | Shotgun + knife | 125 HP, runs faster |
| Sniper | Sniper rifle + pistol | Headshots kill instantly |
| Undead Summoner | SMG + knife | Q raises 3 undead that hunt enemies |

## Game modes

Matches last 5 minutes and rotate automatically:

- **Free For All**: first to 25 kills.
- **Team Deathmatch**: Red vs Blue, first team to 50 kills.
- **Gun Game**: 2 kills moves you to the next gun; win by finishing the knife level.

## How it works

- `server.js`: Node.js server. Checks every shot, runs health, kills, teams and game modes, and controls the bots and the undead (they find their way around the map with a path-finding grid).
- `public/main.js`: the 3D first-person game in the browser, built with [three.js](https://threejs.org).
- `public/models.js`: the 3D soldiers, undead, guns and first-person arms.
- `public/shared.js`: map, weapons, classes and movement physics shared by the server and the browser.

Set `PORT` to use a different port.
