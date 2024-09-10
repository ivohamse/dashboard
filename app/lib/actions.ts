'use server'

import {z} from 'zod';
import {sql} from '@vercel/postgres'
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';


const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: "Please select a customer."
    }),
    amount: z.coerce
        .number()
        .gt(0, {message: "Please insert a number greater than 0"}),
    status: z.enum(['pending','paid'], {invalid_type_error: "Please select an invoice status"}),
    date: z.string()
});

export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };

const CreateInvoice = FormSchema.omit({id: true, date: true})

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: "Missing field. Failed to create invoice"
        }
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountinCents = amount * 100;
    const date = new Date().toISOString().split('T')[0]
    
    try {
        await sql`
        INSERT INTO Invoices (customer_id, amount, status, date)
        VALUES( ${customerId}, ${amountinCents}, ${status}, ${date})
        `;
    } catch (error) {
        console.log(error);
        return { message:`Database error. Failed to create invoice: ${error}` }
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices')
}

const UpdateInvoice = FormSchema.omit({id: true, date: true})

export async function updateInvoice(id: string, prevState: State , formData: FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    })

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: "Missing field. Failed to edit invoice"
        }
    }
    const {customerId, amount, status} = validatedFields.data;
    const amountinCents = amount * 100;

    try {
        await sql`
        UPDATE Invoices
        SET customer_id=${customerId}, amount=${amountinCents}, status=${status}
        WHERE id=${id}
        `;
    } catch (error) {
        console.log(error);
        return { message:`Database error. Failed to update invoice: ${error}` }
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices')
}

export async function deleteInvoice( id: string ) {

    try {
        await sql` DELETE FROM Invoices WHERE id=${id}`;
        revalidatePath('/dashboard/invoices')
        return { message: "Invoice deleted"}
    } catch (error) {
        return { message: `Database error. Failed to delete invoice: ${error}` }
    }  
    
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
          default:
            return 'Something went wrong.';
        }
      }
      throw error;
    }
}