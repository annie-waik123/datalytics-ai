import { Chrome } from "lucide-react";

export default function GoogleButton({ onClick, loading }) {
  return (
    <button className="secondary-btn" type="button" onClick={onClick} disabled={loading}>
      <Chrome className="h-4 w-4" />
      Login with Google
    </button>
  );
}
