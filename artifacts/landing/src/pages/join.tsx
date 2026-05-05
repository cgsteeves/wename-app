import { useEffect } from "react";
import { useParams } from "wouter";

export default function JoinRedirect() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    if (token) {
      window.location.replace(`/app/join/${token}`);
    }
  }, [token]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f9f1de",
        fontFamily: "sans-serif",
        color: "#3d2e20",
      }}
    >
      <p style={{ fontSize: 16, opacity: 0.7 }}>Opening invite…</p>
    </div>
  );
}
