import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDatabase } from "@/lib/init-db";
import { getAuthContext } from "@/lib/tenant";
import { Prisma } from "@prisma/client";

/**
 * GET /api/audit-logs
 *
 * Superuser-only endpoint. Returns audit logs grouped by user,
 * with per-user summary stats and expandable detail logs.
 */
export async function GET(req: NextRequest) {
  try {
    await ensureDatabase();
    const auth = await getAuthContext(req);
    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Superuser access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const action = url.searchParams.get("action") || "";
    const role = url.searchParams.get("role") || "";
    const dateFrom = url.searchParams.get("dateFrom") || "";
    const dateTo = url.searchParams.get("dateTo") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
    const expandUser = url.searchParams.get("expandUser") || ""; // userId to expand

    // ── If expandUser is provided, return that user's detailed logs ──
    if (expandUser) {
      const where: Prisma.AuditLogWhereInput = { userId: expandUser };
      if (action) where.action = { contains: action, mode: "insensitive" };
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) (where.createdAt as Prisma.AuditLogWhereInput)["gte"] = new Date(dateFrom);
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setDate(toDate.getDate() + 1);
          (where.createdAt as Prisma.AuditLogWhereInput)["lt"] = toDate;
        }
      }

      const [logs, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: (page - 1) * limit,
          select: {
            id: true, action: true, targetId: true, targetType: true,
            details: true, ipAddress: true, userAgent: true, createdAt: true,
          },
        }),
        db.auditLog.count({ where }),
      ]);

      return NextResponse.json({ logs, total, page, limit });
    }

    // ── Otherwise, return grouped-by-user summary ──
    const where: Prisma.AuditLogWhereInput = {};
    if (search) {
      where.OR = [
        { userName: { contains: search, mode: "insensitive" } },
        { officerName: { contains: search, mode: "insensitive" } },
        { providerName: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
        { details: { contains: search, mode: "insensitive" } },
        { ipAddress: { contains: search, mode: "insensitive" } },
      ];
    }
    if (action) where.action = { contains: action, mode: "insensitive" };
    if (role) where.userRole = role;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Prisma.AuditLogWhereInput)["gte"] = new Date(dateFrom);
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setDate(toDate.getDate() + 1);
        (where.createdAt as Prisma.AuditLogWhereInput)["lt"] = toDate;
      }
    }

    // Get distinct users with their latest activity and counts
    const usersWithActivity = await db.auditLog.findMany({
      where,
      distinct: ["userId"],
      orderBy: { createdAt: "desc" },
      select: {
        userId: true,
        userName: true,
        userRole: true,
        providerName: true,
        officerName: true,
        ipAddress: true,
        createdAt: true, // latest activity time (due to orderBy)
      },
    });

    // For each user, get count and last login
    const userSummaries = await Promise.all(
      usersWithActivity.map(async (u) => {
        const userWhere: Prisma.AuditLogWhereInput = { ...where, userId: u.userId };
        const [count, lastLogin] = await Promise.all([
          db.auditLog.count({ where: userWhere }),
          db.auditLog.findFirst({
            where: { ...userWhere, action: "LOGIN" },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
        ]);
        return {
          userId: u.userId,
          userName: u.userName,
          userRole: u.userRole,
          providerName: u.providerName,
          officerName: u.officerName,
          lastActivity: u.createdAt,
          lastLogin: lastLogin?.createdAt || null,
          lastIp: u.ipAddress,
          totalActions: count,
        };
      })
    );

    // Sort by last activity descending
    userSummaries.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

    const totalUsers = userSummaries.length;
    const totalPages = Math.max(1, Math.ceil(totalUsers / limit));
    const paginatedUsers = userSummaries.slice((page - 1) * limit, page * limit);

    // Overall stats
    const [totalLogs, todayLogs, uniqueUsersToday] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.count({
        where: {
          ...where,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      db.auditLog.groupBy({
        by: ["userId"],
        where: {
          ...where,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      users: paginatedUsers,
      totalUsers,
      totalLogs,
      todayLogs,
      uniqueUsersToday: uniqueUsersToday.length,
      page,
      totalPages,
      limit,
    });
  } catch (error) {
    console.error("[audit-logs] Error:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
