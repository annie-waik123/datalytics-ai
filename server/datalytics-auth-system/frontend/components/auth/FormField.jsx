export default function FormField({ label, type = "text", name, value, onChange, placeholder, autoComplete }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="input-shell"
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
    </label>
  );
}
