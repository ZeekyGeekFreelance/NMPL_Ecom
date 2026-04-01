export default function MaintenancePage() {
  const name = process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "NMPL";
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="text-6xl mb-6">🔧</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">{name} is under maintenance</h1>
        <p className="text-gray-500">We'll be back shortly. Thank you for your patience.</p>
      </div>
    </div>
  );
}
