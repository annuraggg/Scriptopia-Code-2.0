import { Home, Disc2, BookUser, BookCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const links: {
  title: string;
  icon: React.FC;
  hash: string;
  badge?: number;
}[] = [
  {
    title: "Dashboard",
    icon: Home,
    hash: "",
  },
  {
    title: "Assessments Created",
    icon: BookUser,
    hash: "created",
  },
  {
    title: "Live Assessments Created",
    icon: Disc2,
    hash: "live",
  },
  {
    title: "Assessments Taken",
    icon: BookCheck,
    hash: "taken",
  },
  /*  {
    title: "Analytics",
    icon: LineChart,
  },*/
];

const Sidebar = ({
  active = 0,
  setActive,
}: {
  active: number;
  setActive: (number: number) => void;
}) => {
  return (
    <div className="hidden md:block w-[30%]">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 lg:h-[60px] items-center">
          <a className="flex gap-2 font-semibold">
            <span className="">Assessments</span>
          </a>
        </div>
        <div className="flex-1">
          <nav className="grid items-start text-sm font-medium">
            {links.map((link) => (
              <a
                key={link.title}
                href={`#${link.hash}`}
                className={`flex items-center gap-3 rounded-lg py-4 text-muted-foreground transition-all hover:text-primary ${
                  active === links.indexOf(link) ? "text-primary" : ""
                }`}
                onClick={() => setActive(links.indexOf(link))}
              >
                {/* @ts-expect-error icon is a component */}
                <link.icon className="h-4 w-4" />
                {link.title}
                {link.badge && (
                  <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    {link.badge}
                  </Badge>
                )}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
