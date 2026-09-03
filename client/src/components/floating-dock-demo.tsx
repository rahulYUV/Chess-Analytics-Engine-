import { FloatingDock } from "@/components/ui/floating-dock";
import {
    IconBrandGithub,
    IconStar,
} from "@tabler/icons-react";
import { useState } from "react";

function GitHubIcon() {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="h-full w-full flex items-center justify-center"
        >
            {hovered ? (
                <IconStar className="h-full w-full text-yellow-500 fill-yellow-500" />
            ) : (
                <IconBrandGithub className="h-full w-full text-neutral-500 dark:text-neutral-300" />
            )}
        </div>
    );
}

interface FloatingDockDemoProps {
    onPlayerSelect?: (username: string) => void;
}

export default function FloatingDockDemo({ onPlayerSelect }: FloatingDockDemoProps) {
    const links1 = [
        {
            title: "rootr4hul",
            icon: (
                <div className="h-full w-full rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                    R4
                </div>
            ),
            onClick: () => onPlayerSelect?.("rootr4hul"),
        },
        {
            title: "k1_rahul",
            icon: (
                <img
                    src="https://images.chesscomfiles.com/uploads/v1/user/195711081.1f8aa3a9.200x200o.fc2aa78e54e2.jpg"
                    className="h-full w-full rounded-full object-cover"
                    alt="k1_rahul"
                />
            ),
            onClick: () => onPlayerSelect?.("k1_rahul"),
        },
        {
            title: "Magnus Carlsen",
            icon: (
                <img
                    src="https://images.chesscomfiles.com/uploads/v1/user/3889224.121e2094.200x200o.361c2f8a59c2.jpg"
                    className="h-full w-full rounded-full object-cover"
                    alt="Magnus Carlsen"
                />
            ),
            onClick: () => onPlayerSelect?.("magnuscarlsen"),
        },
        {
            title: "Hikaru Nakamura",
            icon: (
                <img
                    src="https://images.chesscomfiles.com/uploads/v1/user/15448422.88c010c1.200x200o.3c5619f5441e.png"
                    className="h-full w-full rounded-full object-cover"
                    alt="Hikaru Nakamura"
                />
            ),
            onClick: () => onPlayerSelect?.("hikaru"),
        },
        {
            title: "Alexandra",
            icon: (
                <img
                    src="https://images.chesscomfiles.com/uploads/v1/user/28583276.401697ff.200x200o.152b758db93a.jpg"
                    className="h-full w-full rounded-full object-cover"
                    alt="Alexandra"
                />
            ),
            onClick: () => onPlayerSelect?.("alexandrabotez"),
        },
        {
            title: "Praggnanandhaa",
            icon: (
                <img
                    src="https://images.chesscomfiles.com/uploads/v1/user/28692936.02da0bac.200x200o.d0b1b8f66ac2.jpg"
                    className="h-full w-full rounded-full object-cover"
                    alt="Praggnanandhaa"
                />
            ),
            onClick: () => onPlayerSelect?.("rpragchess"),
        },
        {
            title: "Gukesh D",
            icon: (
                <img
                    src="https://images.chesscomfiles.com/uploads/v1/user/40996222.a634fe54.200x200o.391c8e0a4b0b.jpeg"
                    className="h-full w-full rounded-full object-cover"
                    alt="Gukesh D"
                />
            ),
            onClick: () => onPlayerSelect?.("gukeshdommaraju"),
        },
        {
            title: "Samay Raina",
            icon: (
                <img
                    src="https://images.chesscomfiles.com/uploads/v1/user/34666556.66f2552e.200x200o.cf3d51ee4698.jpeg"
                    className="h-full w-full rounded-full object-cover"
                    alt="Samay Raina"
                />
            ),
            onClick: () => onPlayerSelect?.("samayraina"),
        },
        {
            title: "Star on GitHub",
            icon: <GitHubIcon />,
            href: "https://github.com/rahulYUV/ChessWebApi/tree/master",
        },
    ];

    const links2 = [
        {
            title: "GothamChess",
            icon: (
                <img
                    src="https://images.chesscomfiles.com/uploads/v1/user/33945736.eb0c3771.200x200o.cf06060d2143.png"
                    className="h-full w-full rounded-full object-cover"
                    alt="GothamChess"
                />
            ),
            onClick: () => onPlayerSelect?.("GothamChess"),
        },
        {
            title: "Ash Anna",
            icon: (
                <img
                    src="https://assets.gqindia.com/photos/6762a3de979d7d1400723458/16:9/w_2560%2Cc_limit/Ashwin.jpg"
                    className="h-full w-full rounded-full object-cover"
                    alt="Ash Anna"
                />
            ),
            onClick: () => onPlayerSelect?.("ashwin1899"),
        },
        {
            title: "Chahal",
            icon: (
                <img
                    src="https://images.chesscomfiles.com/uploads/v1/user/75751556.76c63f2f.200x200o.633e0c49b62b.jpeg"
                    className="h-full w-full rounded-full object-cover"
                    alt="Chahal"
                />
            ),
            onClick: () => onPlayerSelect?.("YuzvendraChahal"),
        },
        {
            title: "Void",
            icon: (
                <img
                    src="https://images.chesscomfiles.com/uploads/v1/user/317044057.274fdd07.200x200o.9e5545698b41.jpg"
                    className="h-full w-full rounded-full object-cover"
                    alt="Void"
                />
            ),
            onClick: () => onPlayerSelect?.("Wizard_goat"),
        },
        {
            title: "Shivahaiya",
            icon: (
                <img
                    src="https://images.chesscomfiles.com/uploads/v1/user/193169927.b2752e47.200x200o.d92e4c1a9547.jpeg"
                    className="h-full w-full rounded-full object-cover"
                    alt="Shivahaiya"
                />
            ),
            onClick: () => onPlayerSelect?.("shivasaurabh"),
        },
        {
            title: "Fabiano Caruana",
            icon: (
                <img
                    src="https://images.chesscomfiles.com/uploads/v1/user/11177810.9dfc8d31.200x200o.9a9eccebc07c.png"
                    className="h-full w-full rounded-full object-cover"
                    alt="Fabiano Caruana"
                />
            ),
            onClick: () => onPlayerSelect?.("fabianocaruana"),
        },
    ];

    return (
        <div className="flex flex-col items-center justify-center h-auto py-4 w-full gap-4">
            <FloatingDock
                items={links1}
            />
            <FloatingDock
                items={links2}
                size="small"
            />
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-4 text-center max-w-lg leading-relaxed">
                An advanced analytics platform for Chess.com. Gain deep insights into player performance, analyze opening trends, and compare statistics with detailed visualizations. Select a pro to get started.
            </p>
        </div>
    );
}
