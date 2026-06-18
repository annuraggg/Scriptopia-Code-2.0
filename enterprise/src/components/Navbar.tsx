import { UserButton } from "@/auth";
import { Link } from "@heroui/link";
import { Button } from "@heroui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const Navbar = () => {
  const [showMenu, setShowMenu] = useState(false);
  const handleMenu = () => {
    setShowMenu(!showMenu);
  };

  const links = [
    {
      path: "/postings",
      label: "Postings",
    },
    {
      path: "/settings",
      label: "Settings",
    },
  ];

  return (
    <>
      <div
        className={
          "border-b w-full pr-5 flex items-center justify-between sticky top-0 z-50 backdrop-filter backdrop-blur-lg"
        }
      >
        <div className="flex items-center gap-2 sm:gap-5">
          <div className="border-r p-[9.5px]">
            <img
              src="/logo.svg"
              alt="logo"
              className="h-9 w-9 cursor-pointer"
              onClick={() => {
                window.location.href = "/postings";
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-5">
          <div className="hidden md:flex items-center gap-5 text-white">
            {links.map((link) => (
              <a
                key={link.path}
                href={link.path}
                className="text-sm sm:text-sm hover:text-blue-500 duration-200 transition-all hidden md:block"
              >
                {link.label}
              </a>
            ))}
            <div className="flex items-center justify-center ml-2">
              <UserButton />
            </div>
          </div>
          <div className="flex md:hidden" onClick={handleMenu}>
            {!showMenu ? <Menu size={22} /> : <X size={22} />}
          </div>
        </div>
      </div>
      <div
        className={
          !showMenu
            ? "fixed left-[-100] ease-in-out duration-400 hidden md:block"
            : "fixed relaive z-20 left-0 top-0 w-[100%] h-full border-r-gray-900 backdrop-blur-lg ease-in-out duration-400 md:hidden"
        }
      >
        <div className="flex flex-col items-center pt-20 h-full md:hidden">
          {links.map((link) => (
            <Button
              key={link.path}
              href={link.path}
              className="flex text-md sm:text-base text-left border-1 border-gray-600 shadow-md md:hidden my-2  w-[80%] h-[8%] rounded-md justify-start"
              as={Link}
              color="primary"
              showAnchorIcon
              variant="ghost"
            >
              {link.label}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
};

export default Navbar;
