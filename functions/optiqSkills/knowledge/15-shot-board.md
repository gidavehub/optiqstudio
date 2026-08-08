# OPTIQ SKILLS KNOWLEDGE — PART XV: THE SHOT BOARD (scene consistency by picture)
(Internal operating doctrine. Added when the platform started photographing its films before rendering them. Extends Part XIV from faces to places, objects and angles.)

# PART XV — THE SHOT BOARD

> Part XIV fixed the faces. This part fixes everything the faces are standing in.

## 15.1 THE FAILURE THIS EXISTS FOR

A film is a pile of separately generated ten-second clips, and the video model has no memory between them. Character references solved identity: the same person survives nine clips because every clip carries their picture.

The failure then moved to the world. The face is right and the room is wrong — the kitchen has a different window in scene 4, the shop counter changes sides, the light goes from afternoon to evening and back. **Vehicles are the worst of it**: between two clips of the same journey the driver and the passenger swap seats, the steering wheel moves to the other side of the car, a door disappears.

The diagnosis is the same one §14.1 made about faces. Two thousand words of prose is a specification the model *approximates*. A picture is a target it *matches*. A paragraph cannot hold a room still.

## 15.2 WHAT A SHOT BOARD IS

Before any clip is rendered, the film is photographed as stills — the real kind, the kind a production hangs on a wall.

**Set plates.** One photoreal still of every location, **empty of people**. Every frame shot in that location is generated with the plate attached, so the room cannot drift. Empty is not an aesthetic choice: a plate with a person in it drags that person into every frame built from it, which is §14.4's contamination arriving through a different door.

**Prop plates.** One still of every object whose exact appearance matters and recurs — a document, a phone screen, a chat thread, a vehicle, the packaging. Each carries a `detail` field naming what must be *legible* and identical every time: the letterhead, the three messages and who sent them, the plate number. A document whose letterhead changes between two cuts is an error the audience sees.

**Frames.** One still per **camera setup** inside every scene. A ten-second scene with three cuts is three angles, so it gets three frames — each generated from the set plate, plus the character sheets of the people in that setup, plus the prop plates of the objects in it.

Then the frames ride along with the scene's video render, in time order, and the prompt tells the model they are its own frames: open on this one, cut to that one at 3.5s. The clip stops being an interpretation of two thousand words and becomes an interpolation between pictures the director has already seen.

## 15.3 THE ECONOMICS, WHICH ARE THE REAL ARGUMENT

A wrong frame costs one image. A wrong clip costs a video render, and the director finds out three minutes later. Everything this catches is caught at roughly a fortieth of the price, in a form they can look at before spending anything.

That is also why the board is built by its own background job rather than inside the storyboard pipeline: an 18-scene film is around sixty pictures, the image quota is eight a minute, and bolting eight minutes of photography onto a nine-minute pipeline would strand the storyboard itself. A stranded storyboard costs the whole generation; a stranded shot board costs some pictures, and the next pass makes them.

## 15.4 HOW MANY SETUPS A SCENE GETS

Straight from the cut logic in Part VI. A scene whose content **is** physical continuity is ONE setup for the full ten seconds (§6.2) — a legitimate answer and often the strongest. A scene that cuts gets one setup per cut, two or three being the house pattern (§6.3).

**Four is the hard ceiling.** Ten seconds split more ways than that gives each angle under two seconds, which is a trailer. It is also the ceiling on how many stills ride with one render, and §3.8's fusion warning does not stop applying because the images are frames instead of faces.

The setups must tile the ten seconds end to end: no gaps, no overlaps, 0.0s to 10.0s.

## 15.5 THE FIELDS THAT DO THE WORK

**geometry** — where things ARE, as fixed physical facts of the place. Which wall the door is in, which side the counter runs down, who sits where. This is the field that keeps breaking, so it is written bluntly: "the door is in the left-hand wall", never "the room feels open".

**For any vehicle it must state, by name**: which side the steering wheel is on, who is in the driver's seat, who is in the front passenger seat, who is in the back and on which side, which way the vehicle faces, which windows are down. "The two of them sit in front" is exactly the sentence that produces a clip where they have swapped.

**firstFrame** — the single frozen instant a still shows. One moment, present tense, no camera move, no "then". A still cannot pan. Writing the shot into the field that describes the frame is the most common mistake there is, and the gates reject it.

**entry** — does the cut land with the action already underway, or does the frame hold for a beat first? Most cuts inside ten seconds are straight into action; a held frame is a deliberate choice, usually to open a scene or let something land.

## 15.6 WHAT THE CLAUSE SAYS, AND WHAT IT SUPERSEDES

The block appended to the scene prompt tells the video model that the attachments are not references but **its own frames**, gives each one its timecode and its movement, forbids cutting anywhere except at those times, and forbids dissolves.

It ends by explicitly superseding the character-reference quarantine clause above it. That clause was written when attachments were grey-backdrop studio portraits and told the model to discard the backdrop, the flat light and the pose. Frames are the opposite: photographs *of this scene, in the real location*, where **everything in them belongs in the clip**. Leaving the old instruction unanswered is how a scene comes back looking like it was shot in a studio.

The precedence rule inverts, for the same reason: where the frames and the writing disagree about **what something looks like**, the frames win. Where they disagree about **what happens**, the writing wins.

## 15.7 WHEN IT FAILS

Best-effort throughout, like Part XIV. A location whose plate fails falls back to its written lock. A scene whose setups fail renders from its prompt alone, exactly as every film did before this existed. Nothing here is allowed to cost a director their film.
