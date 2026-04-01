import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();
  const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "NMPL";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@nmpl.online";

  return (
    <footer className="bg-gray-900 text-gray-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="text-white font-bold text-lg mb-3">{platformName}</h3>
          <p className="text-sm">Your trusted e-commerce destination for quality products.</p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Shop</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/products" className="hover:text-white transition-colors">All Products</Link></li>
            <li><Link href="/shop" className="hover:text-white transition-colors">Shop</Link></li>
            <li><Link href="/brands" className="hover:text-white transition-colors">Brands</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Account</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link></li>
            <li><Link href="/sign-up" className="hover:text-white transition-colors">Register</Link></li>
            <li><Link href="/orders" className="hover:text-white transition-colors">My Orders</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Support</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/about-us" className="hover:text-white transition-colors">About Us</Link></li>
            <li><a href={`mailto:${supportEmail}`} className="hover:text-white transition-colors">{supportEmail}</a></li>
            <li><Link href="/dealer/register" className="hover:text-white transition-colors">Become a Dealer</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-800 text-center py-4 text-xs">
        © {year} {platformName}. All rights reserved.
      </div>
    </footer>
  );
}
