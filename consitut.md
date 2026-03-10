# Spec for constitution
---

## Explanation of the app
- Rotagotchi is a tamagootchi that gets a webhook when you make a github commit and requires you to watch degenerative content before you can continue working
- The time spent on degenerative websites is proportional to the size of you commmit
- The life of the avatar should be dependent on time spent watching content 
- this should use a white-list//black-list to look at active tabs and determine what is work related and what isn't
  - e.g. white list:
    - tik tok, youtube, instagram, etc.
  - black list:
    - github, outlook, gmail, etc.

## Functional Requirements
- Testing suite from the start
- create whitelist
- enforce whitelist
o Github Polling
    - Logic for actual queries
    - logic for sizes of diffs
- Logic for actual queries
- Backend endpoints for oauth and webhooks
- Animations with lottie

## Tech-stack
- next for builds and development
- lottie for animations
- react // tailwind
- express and supabase for backend

## Libraries
> look at current tech stack
- lottie for animations,

