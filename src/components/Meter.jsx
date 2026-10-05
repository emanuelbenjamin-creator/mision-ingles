export default function Meter({ label, value }) {
  return (
    <div className="meter">
      <div className="mh"><span>{label}</span><b>{value == null ? "—" : value}</b></div>
      <div className="bar"><i style={{ width: (value || 0) + "%" }} /></div>
    </div>
  );
}
