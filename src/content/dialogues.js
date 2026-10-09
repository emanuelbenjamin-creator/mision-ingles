/*
 * Diálogos a dos voces para escuchar. `speakers` son ids de personajes (src/content/characters.js);
 * en cada línea, `s` es el índice del hablante. Hay 2 por banda (A: A1–A2, B: B1–B2, C: C1–C2)
 * para el modo sin IA; con IA se generan nuevos en /api/dialogue.
 */

/** Parejas de personajes para los diálogos generados (voces y acentos distintos entre sí). */
export const PAIRS = [["megan", "tom"], ["jo", "james"], ["hannah", "alex"], ["priya", "mark"], ["emma", "patel"], ["linda", "tourist"], ["rachel", "evans"], ["taylor", "brown"]];

export const DIALOGUES = {
  A: [
    {
      title: "A table for two", setting_es: "Un cliente llega a un restaurante sin reserva.", speakers: ["jo", "tom"],
      lines: [
        [0, "Good evening! Welcome. Do you have a reservation?"],
        [1, "No, I don't. Do you have a table for two?"],
        [0, "Let me check. Yes, we have one next to the window."],
        [1, "Great, thank you. Can we see the menu, please?"],
        [0, "Of course. Today's special is grilled fish with rice."],
        [1, "That sounds good. And what drinks do you have?"],
        [0, "We have water, juice, and lemonade. The lemonade is fresh."],
        [1, "Two lemonades, please. We are very thirsty."],
      ],
      questions: [
        { q: "Does the man have a reservation?", o: ["Yes, for two people", "No, he doesn't", "Yes, for four people"], a: 1 },
        { q: "Where is the table?", o: ["Next to the window", "Near the kitchen", "Outside"], a: 0 },
        { q: "What do they order to drink?", o: ["Water", "Orange juice", "Two lemonades"], a: 2 },
      ],
    },
    {
      title: "Where is the museum?", setting_es: "Una turista pide indicaciones en la calle.", speakers: ["emma", "alex"],
      lines: [
        [0, "Excuse me, is the city museum near here?"],
        [1, "Yes, it is. It's about ten minutes on foot."],
        [0, "Oh good. How do I get there?"],
        [1, "Go straight on this street and turn left at the bank."],
        [0, "Turn left at the bank. And then?"],
        [1, "The museum is the big white building on your right."],
        [0, "Thank you! Is it open today?"],
        [1, "Yes, it's open until six. Have a nice visit!"],
      ],
      questions: [
        { q: "How far is the museum?", o: ["Ten minutes on foot", "Ten minutes by bus", "One hour on foot"], a: 0 },
        { q: "Where does she turn left?", o: ["At the park", "At the bank", "At the school"], a: 1 },
        { q: "What time does the museum close?", o: ["At five", "At eight", "At six"], a: 2 },
      ],
    },
  ],
  B: [
    {
      title: "The late report", setting_es: "Dos colegas hablan de un informe que no está listo.", speakers: ["megan", "james"],
      lines: [
        [0, "Hi James, do you have a minute? It's about the sales report."],
        [1, "Sure. I know it was due yesterday, and I'm sorry about that."],
        [0, "What happened? You're usually so punctual."],
        [1, "The numbers from the Lima office arrived late, so I couldn't finish the analysis."],
        [0, "I see. Could you send me what you have so far?"],
        [1, "Yes, of course. The first three sections are ready."],
        [0, "Perfect. When do you think you can finish the rest?"],
        [1, "If nothing else comes up, I'll have it done by Thursday morning."],
        [0, "Thursday works. Next time, just let me know earlier, okay?"],
        [1, "You're right. I should have told you on Monday."],
      ],
      questions: [
        { q: "Why is the report late?", o: ["James was on holiday", "Some numbers arrived late", "The computer broke"], a: 1 },
        { q: "What does Megan ask him to send?", o: ["The parts that are ready", "A new report", "The numbers from Lima"], a: 0 },
        { q: "When will the report be finished?", o: ["On Monday", "Tonight", "By Thursday morning"], a: 2 },
      ],
    },
    {
      title: "A weekend away", setting_es: "Dos amigos planean una escapada de fin de semana.", speakers: ["priya", "tourist"],
      lines: [
        [0, "I've been thinking. We should get out of the city this weekend."],
        [1, "I'd love that. Where do you have in mind?"],
        [0, "There's a small town in the mountains, about three hours away."],
        [1, "Three hours isn't bad. Should we drive or take the bus?"],
        [0, "The bus is cheaper, but driving gives us more freedom."],
        [1, "True. And if we drive, we can stop wherever we want."],
        [0, "Exactly. I found a guesthouse with a view of the lake."],
        [1, "That sounds perfect. How much is it per night?"],
        [0, "Sixty dollars, breakfast included. Shall I book it?"],
        [1, "Go for it. I'll take care of the petrol."],
      ],
      questions: [
        { q: "How far is the town?", o: ["Thirty minutes away", "About three hours away", "A whole day away"], a: 1 },
        { q: "Why do they decide to drive?", o: ["It is cheaper", "The bus is full", "It gives them more freedom"], a: 2 },
        { q: "What is included in the price?", o: ["Breakfast", "Dinner", "Petrol"], a: 0 },
      ],
    },
  ],
  C: [
    {
      title: "Rethinking the launch", setting_es: "Una directora financiera cuestiona la fecha de un lanzamiento.", speakers: ["linda", "evans"],
      lines: [
        [0, "Before we commit, I'd like to challenge the launch date. March feels optimistic."],
        [1, "I understand the concern, but delaying means handing the market to our competitors."],
        [0, "Perhaps, although launching a half-finished product could damage us far more."],
        [1, "Fair point. What would it take for you to feel comfortable with March?"],
        [0, "A realistic testing schedule, and a clear plan if the supplier lets us down again."],
        [1, "We could bring in a second supplier, though it would eat into our margins."],
        [0, "By how much, roughly? I'd rather pay for certainty than gamble on luck."],
        [1, "Around four percent. It's not negligible, but it's manageable."],
        [0, "Then let's model both scenarios and take them to the board on Friday."],
        [1, "Agreed. I'll have the figures ready by Wednesday so you can go through them."],
      ],
      questions: [
        { q: "What worries Linda about March?", o: ["The product may not be finished", "The competitors are stronger", "The board is against it"], a: 0 },
        { q: "What is the downside of a second supplier?", o: ["It delays the launch", "It reduces their margins", "It lowers quality"], a: 1 },
        { q: "What do they agree to do?", o: ["Cancel the launch", "Launch in March no matter what", "Model both scenarios for the board"], a: 2 },
      ],
    },
    {
      title: "Remote work, revisited", setting_es: "Dos colegas debaten si volver a la oficina.", speakers: ["rachel", "mark"],
      lines: [
        [0, "So the company wants everyone back in the office four days a week. Thoughts?"],
        [1, "Honestly, I'm torn. I get more done at home, yet I miss bouncing ideas off people."],
        [0, "That's exactly it. Collaboration suffers when we only meet on a screen."],
        [1, "Granted, but is forcing people in really the answer? Trust tends to work better than rules."],
        [0, "You may be right. Still, new hires struggle to learn the ropes remotely."],
        [1, "Then make the office worth the commute: fewer meetings, more real teamwork."],
        [0, "I could get behind that. A mandate without a purpose just breeds resentment."],
        [1, "Shall we put it in writing? Management might actually listen to a joint proposal."],
      ],
      questions: [
        { q: "How does Mark feel about the new policy?", o: ["Completely against it", "He has mixed feelings", "Delighted"], a: 1 },
        { q: "Who struggles most with remote work, according to Rachel?", o: ["New hires", "Managers", "Clients"], a: 0 },
        { q: "What do they decide to do?", o: ["Ignore the policy", "Resign together", "Write a joint proposal"], a: 2 },
      ],
    },
  ],
};
