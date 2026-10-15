export const BODIES = {
  // EDIT ME
  sun: { id: "sun", title: "Curiosity", tagline: "The core that powers everything.", role: "The bright center of this system", strength: "Asking what else is possible", exploring: "New ideas, tools, and ways to build", fact: "Everything else here orbits this spark.", moons: [] },
  // EDIT ME
  mercury: { id: "mercury", title: "Fast learning", tagline: "Close to the source, quick to adapt.", role: "Picking up new skills at speed", strength: "Turning a new idea into practice", exploring: "Shorter paths from question to skill", fact: "The closest world moves the fastest.", moons: [] },
  // EDIT ME
  venus: { id: "venus", title: "Music", tagline: "A world with its own atmosphere.", role: "Listening, playing, and feeling rhythm", strength: "Finding the feeling in a piece", exploring: "Sounds, songs, and new listening", fact: "Music gets a whole planet of its own.", moons: [] },
  // EDIT ME
  earth: { id: "earth", title: "Local businesses online", tagline: "Helping Bangalore businesses show up on the web.", role: "Bringing local shops onto the internet", strength: "Clear pages people can actually find", exploring: "How a business looks online", fact: "Home base is Bangalore, one business at a time.", moons: [
    // EDIT ME
    { id: "moon", title: "Google Business Profiles", tagline: "The public face a shop shows first.", role: "Profiles that help people find a business", strength: "Clear, current, easy to trust", exploring: "How a listing introduces a shop", fact: "Often the first hello a customer sees." },
  ] },
  // EDIT ME
  mars: { id: "mars", title: "Chess", tagline: "A red world of plans and patience.", role: "Playing, studying, and thinking ahead", strength: "Staying calm while the board changes", exploring: "Sharper choices over the board", fact: "Two moons: one for the start, one for the finish.", moons: [
    // EDIT ME
    { id: "phobos", title: "Openings", tagline: "How a game begins.", role: "The first moves on the board", strength: "Starting with a clear idea", exploring: "Lines that lead somewhere good", fact: "A strong start makes the middle easier." },
    // EDIT ME
    { id: "deimos", title: "Endgames", tagline: "How a game is finished.", role: "The last, careful moves", strength: "Turning a small edge into a win", exploring: "Positions where every move counts", fact: "The quiet part is often the decisive part." },
  ] },
  // EDIT ME
  jupiter: { id: "jupiter", title: "Websites and 3D design", tagline: "The giant of making things people can see.", role: "Designing sites, scenes, and motion", strength: "Ideas that feel clear and alive", exploring: "Pages, models, and moving pictures", fact: "Four moons, four ways of making.", moons: [
    // EDIT ME
    { id: "io", title: "Web design", tagline: "Pages with a point of view.", role: "Layouts, type, and flow", strength: "Making a visit feel intentional", exploring: "Interfaces that stay easy to use", fact: "The first moon is the first impression." },
    // EDIT ME
    { id: "europa", title: "Blender 3D", tagline: "Shapes built in three dimensions.", role: "Modeling worlds and objects", strength: "Form, light, and space", exploring: "Scenes that hold up from every side", fact: "A smooth surface can hide a lot of craft." },
    // EDIT ME
    { id: "ganymede", title: "Animation", tagline: "Still ideas, set in motion.", role: "Movement with a reason", strength: "Timing that feels natural", exploring: "Motion that explains itself", fact: "The largest moon carries the biggest motion." },
    // EDIT ME
    { id: "callisto", title: "Posters and reels", tagline: "A story told in one frame or a few seconds.", role: "Posters, reels, and short visual hits", strength: "A clear image, quickly understood", exploring: "Frames that stay in memory", fact: "The far moon still has a strong signal." },
  ] },
  // EDIT ME
  saturn: { id: "saturn", title: "Cybersecurity", tagline: "Rings as layers of defense.", role: "Learning how systems stay safe", strength: "Noticing what should not get through", exploring: "Checks, layers, and careful habits", fact: "Each ring is another layer looking out.", moons: [
    // EDIT ME
    { id: "titan", title: "Security checks", tagline: "A pause before something is trusted.", role: "Looking before letting something in", strength: "Careful, repeatable checks", exploring: "What a good check actually catches", fact: "The big moon watches the gate." },
  ] },
  // EDIT ME
  uranus: { id: "uranus", title: "New tools", tagline: "A tilted world for experiments.", role: "Trying tools before they feel familiar", strength: "Comfort with a strange interface", exploring: "Software that changes how work feels", fact: "This planet spins on its side, on purpose.", moons: [
    // EDIT ME
    { id: "titania", title: "Titania", tagline: "A place for the first experiment.", role: "Trying something new", strength: "Starting before it feels perfect", exploring: "What a new tool is good at", fact: "Every useful tool begins with a try." },
    // EDIT ME
    { id: "oberon", title: "Oberon", tagline: "A second look at what might work.", role: "Following up on an experiment", strength: "Keeping what works", exploring: "Which tools earn a permanent place", fact: "A fresh perspective can change the result." },
  ] },
  // EDIT ME
  neptune: { id: "neptune", title: "Future goals", tagline: "The far blue edge of what comes next.", role: "Aims that are still ahead", strength: "Keeping a direction while learning", exploring: "The next thing worth building", fact: "Far away does not mean out of reach.", moons: [
    // EDIT ME
    { id: "triton", title: "Next big project", tagline: "The one that gets the focus next.", role: "The project waiting its turn", strength: "Choosing one thing and going deep", exploring: "What deserves the next long stretch", fact: "This moon travels its own way around the planet." },
  ] },
  // EDIT ME
  asteroid: { id: "asteroid", title: "Small experiments", tagline: "Side projects scattered between the big worlds.", role: "Tests, sketches, and half-built ideas", strength: "Trying something small without waiting", exploring: "Whatever does not fit on a planet yet", fact: "Not every idea needs a whole planet.", moons: [] },
};

export const BODY_ORDER = ["sun", "mercury", "venus", "earth", "moon", "mars", "phobos", "deimos", "jupiter", "io", "europa", "ganymede", "callisto", "saturn", "titan", "uranus", "titania", "oberon", "neptune", "triton", "asteroid"];

export function findBody(id) {
  if (BODIES[id]) return BODIES[id];
  for (const planet of Object.values(BODIES)) {
    const moon = planet.moons?.find((entry) => entry.id === id);
    if (moon) return moon;
  }
  return null;
}
