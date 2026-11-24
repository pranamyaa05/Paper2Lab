/** Captions and narration for the scrolling story on the homepage. */
export interface StoryStep {
  kicker: string;
  title: string;
  body: string;
  narration: string;
}

export const STORY_STEPS: StoryStep[] = [
  {
    kicker: "Paper2Lab",
    title: "Paper2Lab",
    body: "Don't just read science. See it, touch it, experiment with it.",
    narration: "Welcome to Paper2Lab, where textbook diagrams become living science labs.",
  },
  {
    kicker: "Step 01",
    title: "Open your textbook",
    body: "Every chapter is full of diagrams that sit perfectly still on the page.",
    narration: "Step one. Open any textbook. Every chapter is full of diagrams that sit perfectly still on the page.",
  },
  {
    kicker: "Step 02",
    title: "Point your camera",
    body: "Aim your phone at any diagram — like this pulley on an incline.",
    narration: "Step two. Point your phone's camera at a diagram, like this pulley on an incline.",
  },
  {
    kicker: "Step 03",
    title: "Snap & understand",
    body: "AI reads the picture: it finds every part, every label and how they connect.",
    narration: "Step three. Snap! The AI reads the picture and finds every part, label and connection.",
  },
  {
    kicker: "Step 04",
    title: "Watch it come alive",
    body: "Paper2Lab picks the right science and builds a live, accurate 3D model.",
    narration: "Step four. Paper2Lab chooses the right physics and builds a live three dimensional model.",
  },
  {
    kicker: "Step 05",
    title: "Explore with a voice tutor",
    body: "Each part lights up while your tutor explains what it does.",
    narration: "Step five. Explore every part while your voice tutor explains it.",
  },
];
