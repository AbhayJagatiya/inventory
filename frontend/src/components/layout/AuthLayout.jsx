function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      {/* Government header strip */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-white to-green-600" />

      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}

export default AuthLayout

