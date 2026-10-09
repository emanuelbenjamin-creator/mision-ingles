/* Contenido de los juegos de voz. Las bandas son A (A1–A2), B (B1–B2) y C (C1–C2). */

/** Trabalenguas, del más fácil al más difícil. `secs` es el tiempo de un nativo diciéndolo claro. */
export const TWISTERS = [
  { text: "Red lorry, yellow lorry.", secs: 2.5, focus: "/r/ y /l/" },
  { text: "She sells seashells by the seashore.", secs: 3, focus: "/ʃ/ y /s/" },
  { text: "Three free throws.", secs: 2, focus: "/θ/ y /f/" },
  { text: "I think this thing is thicker than that thing.", secs: 3.5, focus: "/θ/ y /ð/" },
  { text: "Very well, very well, very well.", secs: 2.5, focus: "/v/ y /w/" },
  { text: "A big black bug bit a big black bear.", secs: 3.5, focus: "/b/ y vocales cortas" },
  { text: "How much wood would a woodchuck chuck?", secs: 3, focus: "/w/ y /tʃ/" },
  { text: "Fresh fried fish, fish fresh fried.", secs: 3, focus: "/f/, /r/ y /ʃ/" },
  { text: "Peter Piper picked a peck of pickled peppers.", secs: 3.5, focus: "/p/ con aire" },
  { text: "The thirty-three thieves thought that they thrilled the throne throughout Thursday.", secs: 6, focus: "/θ/ sin parar" },
];

/** Preguntas para «Contra reloj»: responde hablando todo lo que puedas en 15 segundos. */
export const CLOCK_QUESTIONS = {
  A: ["What do you usually eat for breakfast?", "Describe your house or apartment.", "What do you do on Sundays?", "Tell me about your best friend.", "What is your favourite food and why?", "What did you do yesterday?"],
  B: ["Describe a trip you will never forget.", "What would you do with one free month?", "What is the best advice you have ever received?", "How has your city changed in the last ten years?", "Describe a skill you would like to learn.", "What makes a good boss?"],
  C: ["Should companies be allowed to track their employees?", "How will artificial intelligence change your profession?", "Is it better to be a specialist or a generalist?", "What is one widely held opinion you disagree with?", "How should cities deal with traffic?", "What does success mean to you?"],
};

/** Adivinanzas: una voz describe la palabra y tú la dices. `alt` son otras respuestas válidas. */
export const RIDDLES = {
  A: [
    { clue: "It is an animal. It says meow and it likes milk.", answer: "cat" },
    { clue: "You use it to open a door. It is small and made of metal.", answer: "key" },
    { clue: "It is yellow and long. Monkeys love to eat it.", answer: "banana" },
    { clue: "You sleep on it every night.", answer: "bed" },
    { clue: "It is the day after Monday.", answer: "tuesday" },
    { clue: "You wear them on your feet when you go outside.", answer: "shoes", alt: ["shoe", "boots"] },
    { clue: "It falls from the sky and makes you wet.", answer: "rain" },
    { clue: "It is a room where you cook.", answer: "kitchen" },
  ],
  B: [
    { clue: "It is the money you pay to the government from your salary.", answer: "taxes", alt: ["tax"] },
    { clue: "It is a person who repairs cars.", answer: "mechanic" },
    { clue: "You do this when you arrive at a hotel and get your key.", answer: "check in", alt: ["checking in", "check-in"] },
    { clue: "It is the last day you can hand in a piece of work.", answer: "deadline" },
    { clue: "It is a meeting where a company asks you questions before giving you a job.", answer: "interview" },
    { clue: "It is the opposite of expensive.", answer: "cheap", alt: ["inexpensive", "affordable"] },
    { clue: "It is the piece of paper that shows what you bought and how much you paid.", answer: "receipt" },
    { clue: "You feel this way when you have slept very badly.", answer: "tired", alt: ["exhausted", "sleepy"] },
  ],
  C: [
    { clue: "It is the money a company keeps after paying all its costs.", answer: "profit", alt: ["profits"] },
    { clue: "It describes something so common that people no longer notice it.", answer: "ordinary", alt: ["commonplace", "mundane"] },
    { clue: "It is a formal agreement that two sides must respect by law.", answer: "contract" },
    { clue: "It is the feeling of regret after doing something wrong.", answer: "guilt", alt: ["remorse"] },
    { clue: "It is what you call a reduction in the size of a company's staff.", answer: "layoffs", alt: ["layoff", "downsizing", "redundancy"] },
    { clue: "It describes a person who always expects good things to happen.", answer: "optimistic", alt: ["optimist"] },
    { clue: "It is a difficult choice between two options that are both bad.", answer: "dilemma" },
    { clue: "It is the ability to recover quickly from difficulties.", answer: "resilience", alt: ["resilient"] },
  ],
};

/** Frases para «Eco veloz»: se repiten a tres velocidades. */
export const ECHO = {
  A: ["Can I have a glass of water, please?", "I would like to go to the park.", "What time does the shop open?", "My brother is taller than me."],
  B: ["I should have called you earlier.", "Could you tell me how to get to the station?", "I have been working here for three years.", "If it rains, we will stay at home."],
  C: ["Had I known about it, I would have acted differently.", "It is not so much the price as the quality that worries me.", "We ought to have double-checked the figures beforehand.", "By the time we arrived, the meeting had already finished."],
};
export const ECHO_SPEEDS = [0.85, 1, 1.2];
