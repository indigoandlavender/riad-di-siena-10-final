import { NextResponse } from "next/server";
import { addPayPalBookingToOps } from "@/lib/sheets";
import { sendBookingEmails } from "@/lib/email";

export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const bookingId = `RDS-${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Extract all booking data
    const {
      // Guest info
      firstName,
      lastName,
      email,
      phone,
      message,
      
      // Stay details
      checkIn,
      checkOut,
      nights,
      guests,
      adults,
      children,
      total,
      
      // Accommodation
      room,
      roomId,
      property,
      tent,
      tentId,
      tentLevel,
      experience,
      experienceId,
      
      // PayPal
      paypalOrderId,
      paypalStatus,
      
      // Legacy fields (from old forms)
      name,
      roomPreference,
    } = body;

    // Handle legacy name field
    const guestFirstName = firstName || name?.split(" ")[0] || "";
    const guestLastName = lastName || name?.split(" ").slice(1).join(" ") || "";
    const fullName = `${guestFirstName} ${guestLastName}`.trim();
    
    // Determine property and accommodation name
    const propertyName = property || "Riad di Siena";
    const accommodationName = room || tent || experience || roomPreference || "";

    // Only store if payment is confirmed
    if (paypalStatus === "COMPLETED") {
      // Write to OPS sheet (Website_Bookings tab)
      const success = await addPayPalBookingToOps({
        booking_id: bookingId,
        guest_name: fullName,
        email: email || "",
        phone: phone || "",
        property: propertyName,
        room_type: accommodationName,
        check_in: checkIn || "",
        check_out: checkOut || "",
        nights: nights || 1,
        guests_count: guests || adults || 1,
        total_price: `€${total || 0}`,
        paypal_order_id: paypalOrderId || "",
        remarks: message || "",
      });

      if (!success) {
        console.error("Failed to write booking to OPS sheet");
        // Continue anyway - don't fail the booking
      }

      // Send confirmation emails
      if (email) {
        try {
          await sendBookingEmails({
            bookingId,
            firstName: guestFirstName,
            lastName: guestLastName,
            email,
            phone,
            property: propertyName,
            room,
            tent,
            experience,
            checkIn,
            checkOut,
            nights: nights || 1,
            guests: guests || 1,
            total: total || 0,
            paypalOrderId,
            message,
          });
        } catch (emailError) {
          console.error("Failed to send booking emails:", emailError);
          // Don't fail the booking if email fails
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        bookingId,
        message: "Booking confirmed"
      });
    }
    
    // For non-completed payments (shouldn't happen with PayPal flow, but handle it)
    return NextResponse.json({ 
      success: false, 
      error: "Payment not completed",
      paypalStatus 
    }, { status: 400 });
    
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Server error" 
    }, { status: 500 });
  }
}

// GET endpoint - bookings are in the OPS dashboard
export async function GET() {
  return NextResponse.json({ 
    message: "View bookings at ops.riaddisiena.com"
  });
}
