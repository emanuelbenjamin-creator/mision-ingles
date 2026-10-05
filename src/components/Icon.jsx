const P = {
  flame: <path fill="currentColor" stroke="none" d="M12 2c1 3.5-1.6 5.2-1.6 8 0 1.3.9 2.3 2 2.3 1.4 0 2.1-1.2 1.8-3 2.6 1.6 4.3 4.2 4.3 7A6.5 6.5 0 0 1 12 22.5 6.5 6.5 0 0 1 5.5 16c0-5.3 5-7.6 6.5-14z" />,
  bolt: <path fill="currentColor" stroke="none" d="M13 2 4 14h6l-1 8 9-12h-6z" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  play: <path fill="currentColor" stroke="none" d="M8 5v14l11-7z" />,
  ear: <><path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5 2" /><path d="M10 10a2 2 0 0 1 4 0" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5" /></>,
  cards: <><rect x="3" y="6" width="14" height="14" rx="2" /><path d="M7 3h12a2 2 0 0 1 2 2v12" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  check: <path strokeWidth="3" d="m5 12 5 5 9-10" />,
};

export default function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}
