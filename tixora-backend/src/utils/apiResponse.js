export class ApiResponse {
  static success(res, data = {}, message = 'Operation completed successfully', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  static created(res, data = {}, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  }

  static error(res, message = 'An error occurred', statusCode = 500, code = 'INTERNAL_ERROR', fields = null) {
    const errorBody = {
      code,
      message
    };
    if (fields) {
      errorBody.fields = fields;
    }
    return res.status(statusCode).json({
      success: false,
      error: errorBody
    });
  }
}
