import { Link } from "react-router-dom";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
} from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";

const LanderNavbar = () => {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  const handleGetStarted = () => {
    if (isSignedIn) {
      navigate("/dashboard");
    } else {
      navigate("/sign-in");
    }
  };
  return (
    <Navbar maxWidth="full">
      <div className="flex items-center gap-6">
        <NavbarBrand>
          <Link to="/" className="flex items-start">
            <div className="w-8 h-8">
              <img src="/logo.svg" alt="Logo" className="w-full h-full" />
            </div>
          </Link>
        </NavbarBrand>

        <NavbarContent className="hidden sm:flex" justify="start">
          <NavbarItem>
            <Link to="https://docs.scriptopia.tech/">Docs</Link>
          </NavbarItem>
        </NavbarContent>
      </div>

      <NavbarContent justify="end">
        <NavbarItem>
          <Button as={Link} variant="light" onClick={handleGetStarted}>
            Sign In
          </Button>
        </NavbarItem>
        <NavbarItem>
          <Button
            as={Link}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() =>
              (window.location.href =
                "https://accounts.scriptopia.tech/sign-up")
            }
          >
            Sign Up
          </Button>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
};

export default LanderNavbar;
