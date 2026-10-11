import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  // Create demo user
  const { data, error } = await supa.auth.signUp({
    email: "demo@bankism.com",
    password: "demo123",
    options: {
      data: {
        full_name: "Demo User"
      }
    }
  });

  if (error) throw error;

  const user = data.user;
  if (!user) throw new Error("User not created");

  // Insert profile
  await supa.from("profiles").insert({
    id: user.id,
    full_name: "Demo User"
  });

  // Insert accounts
  const { data: accounts, error: acctError } = await supa
    .from("accounts")
    .insert({
      user_id: user.id,
      account_number: "10000001",
      account_name: "Savings Account",
      balance: 50000,
      currency: "INR"
    })
    .select();

  if (acctError) throw acctError;

  // Insert beneficiaries
  await supa.from("beneficiaries").insert([
    {
      user_id: user.id,
      beneficiary_name: "Rahul Kumar",
      account_number: "10000003",
      is_default: true
    },
    {
      user_id: user.id,
      beneficiary_name: "Priya Sharma",
      account_number: "10000004"
    },
    {
      user_id: user.id,
      beneficiary_name: "Amit Patel",
      account_number: "10000005"
    }
  ]);

  // Insert sample transactions
  await supa.from("transactions").insert([
    {
      user_id: user.id,
      from_account_id: accounts?.[0]?.id,
      to_account_number: "10000003",
      amount: 5000,
      currency: "INR",
      memo: "Monthly transfer",
      status: "completed"
    },
    {
      user_id: user.id,
      from_account_id: accounts?.[0]?.id,
      to_account_number: "10000004",
      amount: 2000,
      currency: "INR",
      memo: "Friend payment",
      status: "completed"
    },
    {
      user_id: user.id,
      from_account_id: accounts?.[0]?.id,
      to_account_number: "10000005",
      amount: 1000,
      currency: "INR",
      memo: "Brother transfer",
      status: "pending"
    }
  ]);

  console.log("Seed complete!");
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});