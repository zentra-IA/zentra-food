"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Company = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export default function SelecionarEmpresaPage() {
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("USER LOGADO:", user?.id);

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: companyUsers, error: companyUsersError } =
      await supabase
        .from("company_users")
        .select("*")
        .eq("user_id", user.id);

    console.log("COMPANY USERS:", companyUsers);
    console.log("ERRO COMPANY USERS:", companyUsersError);

    if (!companyUsers || companyUsers.length === 0) {
      setLoading(false);
      return;
    }

    const companyIds = companyUsers.map(
      (item) => item.company_id
    );

    const { data: companiesData, error: companiesError } =
      await supabase
        .from("companies")
        .select("*")
        .in("id", companyIds);

    console.log("COMPANIES:", companiesData);
    console.log("ERRO COMPANIES:", companiesError);

    setCompanies(companiesData || []);
    setLoading(false);

  } catch (err) {
    console.error(err);
    setLoading(false);
  }
}

  function selectCompany(company: Company) {
    localStorage.setItem("active_company_id", company.id);

    localStorage.setItem("active_company_slug", company.slug);

    localStorage.setItem("active_company_role", company.role);

    router.push("/painel");
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <p style={styles.text}>Carregando empresas...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Escolha sua empresa</h1>

        {companies.length === 0 && (
          <p style={styles.text}>
            Nenhuma empresa vinculada ao seu usuário.
          </p>
        )}

        {companies.map((company) => (
          <button
            key={company.id}
            style={styles.button}
            onClick={() => selectCompany(company)}
          >
            {company.name}
          </button>
        ))}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff5f5",
    fontFamily: "Arial, sans-serif",
  },

  card: {
    width: "100%",
    maxWidth: 420,
    background: "#fff",
    borderRadius: 16,
    padding: 28,
    border: "1px solid #ffd0d0",
    boxShadow: "0 10px 30px rgba(255,0,0,0.08)",
  },

  title: {
    color: "#e60012",
    marginBottom: 20,
    fontSize: 28,
    fontWeight: 800,
  },

  text: {
    color: "#555",
    fontSize: 14,
  },

  button: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e60012",
    background: "#fff",
    color: "#e60012",
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 12,
    fontSize: 16,
  },
};