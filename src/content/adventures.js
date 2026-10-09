/*
 * Historias con decisiones. Cada aventura tiene un narrador y dos personajes (ids de
 * src/content/characters.js). `open` es la primera escena, igual con o sin IA. Con IA, las escenas
 * siguientes las escribe /api/story-turn según lo que digas; sin IA se juega `tree` (solo la del
 * aeropuerto la tiene completa).
 * Escena: { narration, lines: [[hablante 0|1, texto]], choices: [texto] } · En `tree`, cada opción es [texto, nodo].
 */
export const MAX_SCENES = 6;

export const ADVENTURES = [
  {
    id: "airport", title: "Lost at the airport", title_es: "Perdido en el aeropuerto", cast: ["hannah", "tourist"],
    premise_es: "Tu vuelo de conexión sale en 40 minutos y tu maleta no aparece.",
    premise: "The learner is a traveller at London Heathrow. Their connecting flight leaves in 40 minutes and their suitcase has not arrived. Character 0 is Hannah, an airline agent. Character 1 is Tom, a friendly Irish traveller in the same situation.",
    open: {
      narration: "You are standing at the baggage belt in London. It stops moving. Your suitcase is not there, and your next flight leaves in forty minutes.",
      lines: [[1, "Looks like we're both out of luck. Did yours not come out either?"]],
      choices: ["No, my suitcase is missing too.", "Excuse me, where is the airline desk?", "I don't have time, I have to run to my gate."],
    },
    tree: {
      start: { choices: [["No, my suitcase is missing too.", "desk"], ["Excuse me, where is the airline desk?", "desk"], ["I don't have time, I have to run to my gate.", "run"]] },
      desk: {
        narration: "Tom points to a desk with a short queue. An agent in a blue uniform looks up and smiles.",
        lines: [[0, "Good afternoon. How can I help you today?"]],
        choices: [["My suitcase didn't arrive and my flight leaves soon.", "report"], ["Can you tell me where my bag is?", "report"], ["I want to speak to your manager.", "manager"]],
      },
      run: {
        narration: "You run through the terminal. At the gate, the agent stops you: you cannot board without checking your missing bag report.",
        lines: [[0, "I'm sorry, but you need to report the missing bag first. It only takes two minutes."]],
        choices: [["All right, how do I report it?", "report"], ["Can I report it when I arrive?", "later"]],
      },
      manager: {
        narration: "Hannah keeps smiling, but her voice is firm.",
        lines: [[0, "I'm the supervisor on duty. I'd be glad to help if you tell me what happened."]],
        choices: [["I'm sorry. My suitcase didn't arrive.", "report"], ["My flight leaves soon and I'm nervous.", "report"]],
      },
      report: {
        narration: "Hannah types quickly. On her screen you can see a small map with a suitcase icon.",
        lines: [[0, "I've found it. Your bag is still in Madrid. Could I have your address at your destination?"]],
        choices: [["Yes, I'm staying at a hotel in Edinburgh.", "good"], ["Can you send it on the next flight?", "good"], ["I need my bag today. This is unacceptable.", "calm"]],
      },
      later: {
        narration: "The agent checks her watch and nods.",
        lines: [[0, "Yes, you can. But it's faster here: I just need your name and your address."]],
        choices: [["Okay, let's do it now.", "good"], ["Thank you, I'll do it now then.", "good"]],
      },
      calm: {
        narration: "Tom, behind you in the queue, gives you a small smile. Hannah waits a second before answering.",
        lines: [[0, "I completely understand. I can put it on the first flight tomorrow and deliver it to you."], [1, "That's what they did for me last year. It arrived before breakfast!"]],
        choices: [["That would be great, thank you.", "good"], ["All right. What do I need to sign?", "good"]],
      },
      good: {
        narration: "Hannah prints a paper with a reference number and gives you a small bag with a toothbrush and a T-shirt.",
        lines: [[0, "Here's your reference number. Your bag will arrive tomorrow morning. Your gate is B twelve, and you still have time."], [1, "See? Sorted. Safe travels, my friend!"]],
        ending_es: "Reportaste la maleta perdida, mantuviste la calma y llegaste a tu vuelo. Usaste frases clave: «My suitcase didn't arrive», «Could you send it…?» y «What do I need to sign?».",
      },
    },
  },
  {
    id: "mystery", title: "The missing painting", title_es: "Misterio en Londres", cast: ["bennett", "james"],
    premise_es: "Un cuadro desaparece del museo durante tu visita. Tú viste algo.",
    premise: "The learner is a visitor at a small London museum when a painting disappears. Character 0 is Ms. Bennett, the calm museum director. Character 1 is James, a nervous Scottish security guard. The learner saw something and must describe it, ask questions and help solve the mystery.",
    open: {
      narration: "You are in a quiet museum in London. Suddenly an alarm rings. On the wall in front of you there is an empty frame.",
      lines: [[1, "Nobody move, please! You, by the window. Did you see anything strange?"]],
      choices: ["I saw a man with a big black bag.", "No, I was looking at another painting.", "What happened? Is something missing?"],
    },
  },
  {
    id: "firstday", title: "First day at work", title_es: "Primer día de trabajo", cast: ["megan", "priya"],
    premise_es: "Empiezas en una empresa internacional y todo sale distinto a lo planeado.",
    premise: "It is the learner's first day at an international company. Character 0 is Megan, their manager. Character 1 is Priya, a teammate. Small problems appear: no laptop, a surprise meeting with a client, an invitation to lunch. The learner must introduce themselves, ask for help and make decisions.",
    open: {
      narration: "It is nine o'clock on your first day. You arrive at the office, but there is no desk with your name and nobody at reception.",
      lines: [[1, "Oh, hi! You must be the new person. I'm Priya. Nobody told us you were starting today!"]],
      choices: ["Nice to meet you. Yes, today is my first day.", "Hi! Do you know where my desk is?", "Could you tell Megan that I'm here?"],
    },
  },
  {
    id: "pitch", title: "Five minutes to pitch", title_es: "Presenta tu startup", cast: ["linda", "tom"],
    premise_es: "Tienes cinco minutos con dos inversionistas. Hacen preguntas difíciles.",
    premise: "The learner is the founder of a small startup and has five minutes with two investors. Character 0 is Linda, a sharp Canadian investor focused on numbers. Character 1 is Tom, a direct Australian investor focused on customers. They ask hard questions; the learner must explain the idea, defend it and negotiate.",
    open: {
      narration: "The door closes. Two investors look at you across a long table. A clock on the wall shows five minutes.",
      lines: [[0, "Thanks for coming. We have five minutes. What problem does your company solve?"]],
      choices: ["We help small shops sell online in one day.", "Let me start with a short story about a customer.", "First, may I ask what you usually invest in?"],
    },
  },
];

export const adventureById = id => ADVENTURES.find(a => a.id === id) || null;
