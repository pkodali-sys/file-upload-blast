import { useEffect, useState } from "react";
export default function FtpStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFtp = async () => {
      try {
        const res = await fetch("/api/ftp/check");
        const data = await res.json();
        setIsConnected(data.connected);
      } catch (err) {
        console.error("Failed to check FTP:", err);
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    };

    checkFtp();
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-center">
        {loading ? (
          <p className="text-gray-600 text-lg">Checking FTP connection...</p>
        ) : (
          <>
            <div
              className={`w-24 h-24 mx-auto rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              } flex items-center justify-center shadow-lg`}
            >
              <span className="text-white text-xl font-bold">
                {isConnected ? "✓" : "✗"}
              </span>
            </div>
            <p className="mt-4 text-lg font-semibold">
              FTP Status:{" "}
              <span className={isConnected ? "text-green-600" : "text-red-600"}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
};