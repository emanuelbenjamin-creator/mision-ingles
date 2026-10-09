/*
 * Elenco de la app. Cada personaje tiene su voz de Gemini, su voz Kokoro de respaldo (solo hay
 * de EE. UU. y Reino Unido), su acento y su tono. Los escenarios apuntan a un personaje con `char`.
 */
export const CHARACTERS = {
  alex: { name: "Alex", bio_es: "Tu compañero de conversación. Curioso y relajado.", voice: "Puck", kokoroVoice: "am_puck", accent: "us", tone: "friendly", g: "m" },
  sam: { name: "Sam", bio_es: "Profesor paciente: pregunta, espera y corrige con calma.", voice: "Achird", kokoroVoice: "am_michael", accent: "us", tone: "calm", g: "m" },
  bennett: { name: "Ms. Bennett", bio_es: "Examinadora IELTS de Londres. Neutral y precisa.", voice: "Gacrux", kokoroVoice: "bf_emma", accent: "uk", tone: "formal", g: "f" },
  megan: { name: "Megan", bio_es: "Reclutadora de una empresa de tecnología en California.", voice: "Sulafat", kokoroVoice: "af_heart", accent: "us", tone: "friendly", g: "f" },
  jo: { name: "Jo", bio_es: "Barista de Nueva York. Habla rápido y con buen humor.", voice: "Laomedeia", kokoroVoice: "af_bella", accent: "us", tone: "cheerful", g: "f" },
  hannah: { name: "Hannah", bio_es: "Agente de aerolínea en Heathrow. Clara y formal.", voice: "Erinome", kokoroVoice: "bf_isabella", accent: "uk", tone: "formal", g: "f" },
  patel: { name: "Dr. Patel", bio_es: "Médico general. Tranquilo; habla inglés de la India.", voice: "Iapetus", kokoroVoice: "bm_george", accent: "in", tone: "calm", g: "m" },
  tom: { name: "Tom", bio_es: "Cliente australiano. Directo, va al grano.", voice: "Orus", kokoroVoice: "am_onyx", accent: "au", tone: "formal", g: "m" },
  riley: { name: "Sam", bio_es: "Tu colega de oficina. Informal, charla de lunes.", voice: "Zubenelgenubi", kokoroVoice: "am_liam", accent: "us", tone: "friendly", g: "m" },
  evans: { name: "Mr. Evans", bio_es: "Cliente extranjero, preocupado por una carta de SUNAT.", voice: "Algieba", kokoroVoice: "bm_lewis", accent: "uk", tone: "calm", g: "m" },
  linda: { name: "Linda", bio_es: "CFO canadiense. Exigente con los números.", voice: "Kore", kokoroVoice: "af_kore", accent: "ca", tone: "formal", g: "f" },
  rachel: { name: "Rachel", bio_es: "Gerente de compras. Tiene cinco minutos.", voice: "Pulcherrima", kokoroVoice: "af_nova", accent: "us", tone: "news", g: "f" },
  mark: { name: "Mark", bio_es: "Cliente molesto de Irlanda: su pedido llegó roto.", voice: "Algenib", kokoroVoice: "bm_daniel", accent: "ie", tone: "formal", g: "m" },
  priya: { name: "Priya", bio_es: "Scrum master de Bangalore. Ágil y amable.", voice: "Autonoe", kokoroVoice: "af_sarah", accent: "in", tone: "cheerful", g: "f" },
  james: { name: "James", bio_es: "Cliente escocés con la web caída. Apurado.", voice: "Alnilam", kokoroVoice: "bm_fable", accent: "sco", tone: "formal", g: "m" },
  brown: { name: "Mr. Brown", bio_es: "Turista australiano con fiebre.", voice: "Umbriel", kokoroVoice: "am_adam", accent: "au", tone: "calm", g: "m" },
  emma: { name: "Emma", bio_es: "Clienta británica en la farmacia.", voice: "Despina", kokoroVoice: "bf_lily", accent: "uk", tone: "friendly", g: "f" },
  taylor: { name: "Mrs. Taylor", bio_es: "Huésped canadiense que llega tarde y sin reserva.", voice: "Vindemiatrix", kokoroVoice: "af_jessica", accent: "ca", tone: "formal", g: "f" },
  tourist: { name: "Tom", bio_es: "Turista irlandés, curioso por todo en Cusco.", voice: "Fenrir", kokoroVoice: "am_fenrir", accent: "ie", tone: "cheerful", g: "m" },
  narrator: { name: "Narrador", bio_es: "La voz que cuenta las historias.", voice: "Charon", kokoroVoice: "bm_george", accent: "uk", tone: "calm", g: "m" },
};

/** Personaje de cada escenario (los especiales de voz en vivo y los de juego de roles). */
export const SCENARIO_CHAR = {
  free: "alex", tutor: "sam", ielts: "bennett",
  job: "megan", cafe: "jo", airport: "hannah", doctor: "patel", client: "tom", small: "riley",
  acc_client: "evans", acc_cfo: "linda", sales_call: "rachel", sales_complaint: "mark",
  it_standup: "priya", it_outage: "james", health_intake: "brown", health_pharmacy: "emma",
  tour_reception: "taylor", tour_guide: "tourist",
};

export const characterById = id => (CHARACTERS[id] ? { id, ...CHARACTERS[id] } : null);
export const characterFor = scenarioId => characterById(SCENARIO_CHAR[scenarioId]) || characterById("alex");
