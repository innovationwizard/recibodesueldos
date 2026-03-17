import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const SEED_DATA = [
  { full_name: "Antonio José Rada Arzola", email: "antonio.rada@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Telma Patricia Castillo Caballeros", email: "thelma.castillo@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Alma Elizabeth Soto Larios", email: "alma.soto@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Paula Alejandra Hernandez Véliz", email: "paula.hernandez@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Efren Miguel Sánchez Reyes", email: "efren.sanchez@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Eder Daniel Veliz Mazariegos", email: "eder.veliz@puertaabierta.com", company_name: "Puerta Abierta" },
  { full_name: "Jarmelfry Isaac Ordoñez Reyes", email: "isaac.ordoñez@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Zucell Anahi Cisneros Hernández", email: "zucell.cisneros@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Alek Salvador Hernández Valdez", email: "alek.hernandez@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Rony Rolando Ramírez Gutierrez", email: "rony.ramirez@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Delfa Maricruz Priego Rivera", email: "delfa.priego@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "José Antonio Gutierrez Navichoque", email: "jose.gutierrez@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Sebastián Carrillo Burmester", email: "sebastian.carrillo@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Pablo Israel Marroquín Zapón", email: "pablo.marroquin@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Erwin Arnaldo Cardona Lima", email: "erwin.cardona@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Keilly Patricia Pinto Noguera", email: "keilly.pinto@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Andrea Lucero Gonzalez Galvez", email: "andrea.gonzalez@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Cesar Aníbal Velásquez Lemus", email: "cesarvesquez05@gmail.com", company_name: "Puerta Abierta" },
  { full_name: "Ervin Ivan Castillo Mata", email: "ivan.castillo@puertaabierta.com.gt", company_name: "Puerta Abierta" },
  { full_name: "Blanca Estela Rodriguez", email: "blanca.rodriguez@tcg.com.gt", company_name: "Grupo Orión" },
  { full_name: "Ferdy Hernán Contreras Rodas", email: "ferdy.contreras@tcg.com.gt", company_name: "Grupo Orión" },
  { full_name: "José Roberto López Cortez", email: "jose.lopez@hopesource.com.gt", company_name: "Grupo Orión" },
  { full_name: "Guadalupe Rodriguez", email: "gr24927@mail.com", company_name: "Grupo Orión" },
  { full_name: "Evelyn Magaly Orellana Gonzalez de Dubón", email: "evelyn.orellana@hopesource.com.gt", company_name: "Grupo Orión" },
  { full_name: "Jesika Noemí López García", email: "recepcion@tcg.com.gt", company_name: "Grupo Orión" },
  { full_name: "Byron Alberto Cifuentes Rodas", email: "byroncifuentes.jb@gmail.com", company_name: "Grupo Orión" },
  { full_name: "Luis Sadrac Ajanel Sontay", email: "luis.ajanel@grupoorion.com.gt", company_name: "Grupo Orión" },
  { full_name: "Héctor Manuel González Guzman", email: "hector.gonzalez@hopesource.com.gt", company_name: "Grupo Orión" },
  { full_name: "Jairo Emmanuel Azurdia Fuentes", email: "jairo.fuentes@tcg.com.gt", company_name: "Grupo Orión" },
  { full_name: "William Rodrigo Alfaro González", email: "william.alfaro@grupoorion.com.gt", company_name: "Grupo Orión" },
  { full_name: "Dina Paola Morales Xiquin", email: "paola.morales@grupoorion.com.gt", company_name: "Grupo Orión" },
  { full_name: "Javier Alexander Morales Ramos", email: "javier.morales@grupoorion.com.gt", company_name: "Grupo Orión" },
  { full_name: "Duglas Gyovanni Mux Curruchiche", email: "duglas.mux@grupoorion.com.gt", company_name: "Grupo Orión" },
  { full_name: "Jorge David Revolorio Agustín", email: "jorge.revolorio@tcg.com.gt", company_name: "Grupo Orión" },
  { full_name: "Miguel Angel Barrios López", email: "miguel.barrios@grupoorion.com.gt", company_name: "Grupo Orión" },
];

// POST /api/employees/seed — one-time seed from LISTADO DE PERSONAL Y CORREO
export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const emp of SEED_DATA) {
    const { data: existing } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_name", emp.company_name)
      .eq("full_name", emp.full_name)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("employees").insert({
      user_id: user.id,
      full_name: emp.full_name,
      email: emp.email,
      company_name: emp.company_name,
      is_active: true,
    });

    if (error) {
      errors.push(`${emp.full_name}: ${error.message}`);
    } else {
      inserted++;
    }
  }

  return NextResponse.json({ inserted, skipped, errors });
}
