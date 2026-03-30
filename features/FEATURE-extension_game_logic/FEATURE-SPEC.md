# Feature Spec -> Extension Game Logic
---

## Resources
---
`./res/list.js` -> Example list creation - should be a standalone file in `lib/`

## Requirements 
---
- Begin actual game logic
- Read from supabase for current users most recent commit with diff size etc.
    - this should automatically happen when the webhook receives a new event
- calculate the debt and then submit a notification for user to watch degenerative content
    - if the user watches degnerative content immediately, a big boost to health
    - otherwise begin to slowly remove health until they watch degenerative content
    - using the blacklist, remove health faster if they continue to engage in work 
    - make sure to update the animations based on the current state of tamagotchi and the current website
    - also add death with restart button
- add a tick speed slider to a small settings menu so that all functionality can be demoed quickly
- Add popup messages to the extension that show the character talking about its current status
- make sure the status (health, does it need "feeding") is clearly visible in UI 
- add hunger and satiated notifications
