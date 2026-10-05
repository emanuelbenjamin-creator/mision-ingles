/* Lecturas de respaldo (sin IA), una por banda. Con IA se genera una nueva cada día según nivel y profesión. */
export const STORIES = {
  A: {
    title: "A New Job",
    text: "Maria lives in Lima with her brother. Last month, she started a new job at a small bakery near her house. Every morning, she wakes up at five o'clock and walks to work. She makes bread and cakes, and she also talks to the customers.\n\nAt first, Maria was nervous because some customers were tourists and spoke English. Now she practises English every evening with an app. She learns ten new words every day. Yesterday, a woman from Canada asked her about the cakes, and Maria answered in English. The woman smiled and bought three cakes. Maria was very happy.",
    glossary: [["bakery", "panadería"], ["customers", "clientes"], ["nervous", "nerviosa"], ["tourists", "turistas"], ["practises", "practica"], ["answered", "respondió"], ["bought", "compró"], ["wakes up", "se despierta"]],
    questions: [
      { q: "Where does Maria work?", o: ["In a hospital", "In a bakery", "In a hotel"], a: 1 },
      { q: "Why was Maria nervous at first?", o: ["Some customers spoke English", "She woke up late", "Her brother was sick"], a: 0 },
      { q: "What did the woman from Canada do?", o: ["She asked for the bill", "She bought three cakes", "She took a photo"], a: 1 },
    ],
  },
  B: {
    title: "The Deadline",
    text: "Daniel had been working at the accounting firm for only three months when his manager asked him to prepare a report for an international client. The deadline was Friday, and the client expected everything in English.\n\nOn Wednesday, Daniel realized that some of the figures didn't match. Instead of panicking, he went through the spreadsheets line by line and found that two invoices had been recorded twice. He corrected the mistake, wrote a short explanation, and sent an email to his manager asking whether he should mention it to the client.\n\nHis manager was impressed. \"Most people would have ignored it,\" she said. \"Being honest about errors builds trust.\" On Friday, the report was delivered on time, and the client asked Daniel to join the next video call.",
    glossary: [["deadline", "fecha límite"], ["firm", "empresa, estudio"], ["figures", "cifras"], ["realized", "se dio cuenta"], ["spreadsheets", "hojas de cálculo"], ["invoices", "facturas"], ["recorded", "registradas"], ["impressed", "impresionada"], ["trust", "confianza"], ["delivered", "entregado"]],
    questions: [
      { q: "What problem did Daniel find?", o: ["Two invoices were recorded twice", "The client cancelled the order", "The report was in Spanish"], a: 0 },
      { q: "How did the manager react?", o: ["She was angry", "She was impressed", "She ignored the email"], a: 1 },
      { q: "What happened on Friday?", o: ["The report was late", "Daniel lost his job", "The report was delivered on time"], a: 2 },
    ],
  },
  C: {
    title: "Rethinking the Office",
    text: "When the company announced that employees could work remotely three days a week, many managers expected productivity to decline. The opposite happened. Within six months, project delivery times had fallen by twelve percent, and staff turnover had reached its lowest level in a decade.\n\nNevertheless, the transition was not without drawbacks. Junior employees reported feeling isolated and admitted that they were reluctant to ask questions over video calls. To address this, the company introduced a mentoring scheme in which every new hire was paired with a senior colleague who would check in with them twice a week.\n\nThe lesson, according to the head of human resources, is that flexibility alone is not enough. \"Remote work succeeds when it is designed deliberately,\" she argued, \"rather than simply tolerated.\"",
    glossary: [["remotely", "a distancia"], ["decline", "disminuir"], ["turnover", "rotación de personal"], ["drawbacks", "desventajas"], ["isolated", "aislados"], ["reluctant", "reacios"], ["scheme", "programa"], ["paired", "emparejado"], ["deliberately", "intencionalmente"], ["tolerated", "tolerado"]],
    questions: [
      { q: "What happened to staff turnover?", o: ["It reached its lowest level in a decade", "It doubled", "It stayed the same"], a: 0 },
      { q: "Which problem did junior employees report?", o: ["Too many meetings", "Feeling isolated", "Low salaries"], a: 1 },
      { q: "What is the main lesson?", o: ["Remote work should be banned", "Flexibility must be designed deliberately", "Managers should work from home"], a: 1 },
    ],
  },
};
