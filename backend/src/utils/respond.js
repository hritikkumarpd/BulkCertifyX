// Consistent success envelope. Errors use the errorHandler middleware.
export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function created(res, data) {
  return ok(res, data, 201);
}

export function paginated(res, items, { page, pageSize, total }) {
  return res.json({
    success: true,
    data: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
