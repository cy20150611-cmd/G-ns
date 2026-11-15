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
| Switch weapon (primary / secondary / blade) | 1 / 2 / 3 or mouse wheel |
| Equipment | Q |
| Scoreboard | Tab |
| Menu | Esc |

## Gun sets

Build your own sets in the **Gun Sets** tab, using the same sections as the [G-NS Armory](https://g-ns-armory.floweryprawn4.chatgpt.site):

- **Primary** (50): HK416, AK-74, MP5, SCAR-H, P90, Vector, SPAS-12, M249, M110, AWM, Barrett M82…
- **Secondary** (50): Glocks, SIGs, Desert Eagle, Colt Python, S&W Model 29…
- **Blades** (10): KA-BAR, Karambit, Kukri, Combat Tomahawk…
- **Equipment** (Q button, 10): Camera Quadcopter, M67 Grenade, Field Radio, Night Vision, Medical Kit, Rangefinder, Tactical Flashlight, Ballistic Shield, Utility Pack, Camera Sensor
- **Operators** (10): the outfit your soldier (and your backup squad) wears

Every gun has its own stats. Make as many sets as you want; shared sets can be found by anyone with **Search**.

**Field Radio backup:** calls 3 soldiers wearing your operator outfit. Every call levels them up (max level 5):
the **Leader** picks the target for the squad and upgrades his secondary (Glock 17 → Python → Desert Eagle → Glock 18 → Model 29),
the **Gunner** upgrades his primary (Makarov → Uzi → M4A1 → AK-12 → M249),
the **Grenadier** throws grenades faster and harder.

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
- `public/armory.js`: the weapon, equipment and operator 3D models from the G-NS Armory.
- `public/models.js`: 3D soldiers, undead, first-person arms and their animations; fits the armory models into the game.
- `public/shared.js`: guns, gun sets, modes, maps and movement physics shared by server and browser.

Set `PORT` to use a different port.
