import { UserButton } from "@/auth";
import { useTheme } from './theme-provider';
import { Button } from "@heroui/react";
import { Moon, Sun } from 'lucide-react';
import Wallet from './Wallet';
import { useAuth } from "@/auth";

const Navbar = ({ refetch }: { refetch: boolean }) => {
  const { userId } = useAuth();
  const links = [
    {
      path: "/problems",
      label: "Problems",
    },
    {
      path: "/assessments",
      label: "Assessments",
    },
  ];

  const { theme, setTheme } = useTheme();

  return (
    <div className="px-5 sm:px-10 w-full h-[8vh] flex items-center justify-between sticky top-0 z-50 backdrop-filter backdrop-blur-lg mb-2">
      <div className="flex items-center gap-2 sm:gap-5">
        <img
          src="/logo.svg"
          alt="logo"
          className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-5 cursor-pointer"
          onClick={() => {
            window.location.href = "/dashboard";
          }}
        />
        <p className="flex text-md sm:text-base duration-200 transition-all md:hidden">
          Scriptopia
        </p>
        {links.map((link) => (
          <a
            key={link.path}
            href={link.path}
            className="text-sm sm:text-base hover:text-blue-500 duration-200 transition-all hidden md:block"
          >
            {link.label}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-2 sm:gap-5">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            className="hidden"
            size="sm"
            variant="flat"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          {userId && <Wallet userId={userId} refetch={refetch} />}
          <UserButton />
        </div>
      </div>
    </div >
  );
};

export default Navbar;