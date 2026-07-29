import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice, AuthError } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    // ── City-wide room statistics ──
    const totalRooms = await db.room.count();
    const availableRooms = await db.room.count({ where: { status: "AVAILABLE" } });
    const occupiedRooms = await db.room.count({ where: { status: "OCCUPIED" } });
    const reservedRooms = await db.room.count({ where: { status: "RESERVED" } });
    const maintenanceRooms = await db.room.count({ where: { status: "MAINTENANCE" } });

    // ── Room type breakdown ──
    const roomTypes = await db.room.groupBy({
      by: ["type"],
      _count: { id: true },
    });

    // ── Per-provider room breakdown ──
    const providers = await db.provider.findMany({
      where: { status: "APPROVED" },
      include: {
        rooms: {
          select: {
            id: true,
            number: true,
            name: true,
            type: true,
            status: true,
            floor: true,
            capacity: true,
            pricePerNight: true,
          },
          orderBy: { number: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    // Build per-provider stats with room counts by status
    const providerStats = providers.map((p) => {
      const rooms = p.rooms;
      const total = rooms.length;
      const available = rooms.filter((r) => r.status === "AVAILABLE").length;
      const occupied = rooms.filter((r) => r.status === "OCCUPIED").length;
      const reserved = rooms.filter((r) => r.status === "RESERVED").length;
      const maintenance = rooms.filter((r) => r.status === "MAINTENANCE").length;
      const utilizationRate = total > 0 ? Math.round(((occupied + reserved) / total) * 100) : 0;
      const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
      const avgPrice = total > 0 ? Math.round(rooms.reduce((sum, r) => sum + r.pricePerNight, 0) / total) : 0;

      return {
        id: p.id,
        name: p.name,
        ownerName: p.ownerName,
        phone: p.phone,
        address: p.address,
        licenseNo: p.licenseNo,
        latitude: p.latitude,
        longitude: p.longitude,
        total,
        available,
        occupied,
        reserved,
        maintenance,
        utilizationRate,
        totalCapacity,
        avgPrice,
        rooms,
      };
    });

    // ── Capacity stats ──
    const totalCapacity = providerStats.reduce((sum, p) => sum + p.totalCapacity, 0);
    const totalOccupied = providerStats.reduce((sum, p) => sum + p.occupied, 0);
    const totalReserved = providerStats.reduce((sum, p) => sum + p.reserved, 0);
    const totalUtilizationRate = totalRooms > 0 ? Math.round(((totalOccupied + totalReserved) / totalRooms) * 100) : 0;

    return NextResponse.json({
      // City-wide summary
      summary: {
        totalProviders: providers.length,
        totalRooms,
        totalCapacity,
        availableRooms,
        occupiedRooms,
        reservedRooms,
        maintenanceRooms,
        utilizationRate: totalUtilizationRate,
      },
      // Room type distribution
      roomTypes: roomTypes.map((rt) => ({
        type: rt.type,
        count: rt._count.id,
      })),
      // Per-provider breakdown
      providers: providerStats,
    });
  } catch (error: unknown) {
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
    const message = error instanceof Error ? error.message : "Failed to fetch room availability";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
