import Link from "next/link";
import Image from "next/image";
import NavItems from "@/components/NavItems";
import {searchStocks} from "@/lib/actions/polygon.actions";

const Header = async () => {
    const initialStocks = await searchStocks();

    return (
        <header className="sticky top-0 header">
            <div className="container header-wrapper">
                <Link href="/">
                    <Image src="/assets/icons/logo.svg" alt="Signalist logo" width={140} height={32} className="h-8 w-auto cursor-pointer" />
                </Link>
                <nav className="flex-1 flex justify-center">
                    <NavItems initialStocks={initialStocks} />
                </nav>
            </div>
        </header>
    )
}
export default Header
