import { Loader2 } from "lucide-react";

export default function PrimaryButton({ children, loading, type = "button", onClick }) {
  return (
    <button className="primary-btn" type={type} onClick={onClick} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
