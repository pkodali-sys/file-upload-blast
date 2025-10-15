import React from "react";

interface TermsModalProps {
  onAccept: () => void;
  onLogout: () => void;
}

export default function TermsModal({ onAccept, onLogout }: TermsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full text-center">
        <h2 className="text-2xl font-bold mb-4">Terms & Conditions</h2>
        <p className="mb-6">
          What is Lorem Ipsum?
Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.

Why do we use it?

        </p>
        <div className="flex justify-center gap-4">
          <button
            className="bg-green-800 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={onAccept}
          >
            Accept
          </button>
          <button
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
