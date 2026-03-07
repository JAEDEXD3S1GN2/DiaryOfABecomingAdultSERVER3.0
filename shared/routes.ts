import { z } from 'zod';
import { insertUserSchema, insertBlogPostSchema, insertCommentSchema, insertMessageSchema, users, blogPosts, comments, messages, homeImages } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: insertUserSchema,
      responses: {
        201: z.object({ token: z.string(), user: z.custom<typeof users.$inferSelect>() }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({ email: z.string().email(), password: z.string() }),
      responses: {
        200: z.object({ token: z.string(), user: z.custom<typeof users.$inferSelect>() }),
        401: errorSchemas.unauthorized,
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    getUser: {
      method: 'GET' as const,
      path: '/api/users/:id' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  posts: {
    list: {
      method: 'GET' as const,
      path: '/api/posts' as const,
      input: z.object({
        genre: z.string().optional(),
        search: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof blogPosts.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/posts/:id' as const,
      responses: {
        200: z.custom<typeof blogPosts.$inferSelect & { author: typeof users.$inferSelect | null }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/posts' as const,
      input: insertBlogPostSchema,      
      responses: {
        201: z.custom<typeof blogPosts.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/posts/:id' as const,
      input: insertBlogPostSchema.partial(),
      responses: {
        200: z.custom<typeof blogPosts.$inferSelect>(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/posts/:id' as const,
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  comments: {
    list: {
      method: 'GET' as const,
      path: '/api/posts/:postId/comments' as const,
      responses: {
        200: z.array(z.custom<typeof comments.$inferSelect & { user: typeof users.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/posts/:postId/comments' as const,
      input: z.object({ content: z.string() }),
      responses: {
        201: z.custom<typeof comments.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/comments/:id' as const,
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  messages: {
    create: {
      method: 'POST' as const,
      path: '/api/contact' as const,
      input: insertMessageSchema,
      responses: {
        201: z.custom<typeof messages.$inferSelect>(),
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/contact' as const,
      responses: {
        200: z.array(z.custom<typeof messages.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
  },
  images: {
    list: {
      method: 'GET' as const,
      path: '/api/images' as const,
      input: z.object({ type: z.string().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof homeImages.$inferSelect>()),
      },
    },
  },
  upload: {
    create: {
      method: 'POST' as const,
      path: '/api/upload' as const,
      responses: {
        201: z.object({ url: z.string() }),
        500: errorSchemas.internal,
      },
    },
  },
  admin: {
  dashboard: {
    method: 'GET' as const,
    path: '/api/admin/dashboard' as const,
    responses: {
      200: z.object({
        users: z.array(z.custom<typeof users.$inferSelect>()),
        posts: z.array(z.custom<typeof blogPosts.$inferSelect>()),
        messages: z.array(z.custom<typeof messages.$inferSelect>()),
        comments: z.array(z.custom<typeof comments.$inferSelect>()),
      }),
      401: errorSchemas.unauthorized,
    },
  },
},
};



export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
