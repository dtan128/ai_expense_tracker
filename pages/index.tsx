import { GetServerSideProps } from "next";
import { isAuthenticated } from "@/lib/auth";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  return {
    redirect: {
      destination: isAuthenticated(ctx.req) ? "/dashboard" : "/login",
      permanent: false,
    },
  };
};

export default function Home() {
  return null;
}
