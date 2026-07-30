import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "./shared/routes";
import { z } from "zod";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import { requireAdmin } from "./middlewares/admin";
import { db } from "./db";
import { users, blogPosts, messages, comments } from "./shared/schema";
import multer from "multer";
import "dotenv/config";
import { eq } from 'drizzle-orm';
import cors from "cors";
// import { specs } from "./swagger";

const scryptAsync = promisify(scrypt);

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

// Auth Middleware
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    (req as any).user = user;
    next();
  });
};

// Decodes the token when present but never rejects the request, so public
// routes (like GET /api/posts/:id) can tell who's viewing without requiring login.
const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (!err) (req as any).user = user;
    next();
  });
};

const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

import swaggerUi from "swagger-ui-express";
import { specs } from "./swagger";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // --- Swagger Documentation ---
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

  /**
   * @openapi
   * /api/auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, email, password]
   *             properties:
   *               name: { type: string }
   *               email: { type: string }
   *               password: { type: string }
   *     responses:
   *       201:
   *         description: User created successfully
   */
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existingUser = await storage.getUserByEmail(input.email);
      if (existingUser) return res.status(400).json({ message: "Email already exists" });
      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
      res.status(201).json({ token, user });
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  /**
   * @openapi
   * /api/auth/login:
   *   post:
   *     summary: Login user
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email: { type: string }
   *               password: { type: string }
   *     responses:
   *       200:
   *         description: Login successful
   */
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByEmail(input.email);
      if (!user || !(await comparePasswords(input.password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
      console.log("SIGN SECRET:", process.env.JWT_SECRET);
      res.json({ token, user });
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  /**
   * @openapi
   * /api/posts:
   *   get:
   *     summary: Get all blog posts
   *     tags: [Posts]
   *     responses:
   *       200:
   *         description: List of blog posts
   */

  /**
 * @openapi
 * /api/posts:
 *   post:
 *     summary: Create a new blog post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, genre]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               genre:
 *                 type: string
 *               thumbnailUrl:
 *                 type: string
 *               videoUrl:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Post created successfully
 */
app.post(
  api.posts.create.path,
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const input = api.posts.create.input.parse(req.body);

      const newPost = await db
        .insert(blogPosts)
        .values({
          ...input,
          authorId: (req as any).user.id,
        })
        .returning();

      res.status(201).json(newPost[0]);
    } catch (error) {
      console.error(error);
      res.status(400).json({ message: "Failed to create post" });
    }
  }
);

/**
 * @openapi
 * /api/posts/{id}:
 *   patch:
 *     summary: Update a blog post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 */
app.patch(api.posts.update.path, authenticateToken, isAdmin, async (req: Request, res: Response) => {
  const postId = Number(req.params.id);
  const updates = req.body;

  try {
    const updatedPost = await db.update(blogPosts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(blogPosts.id, postId))
      .returning();

    if (!updatedPost[0]) return res.status(404).json({ message: "Post not found" });
    res.json(updatedPost[0]);
  } catch (err) {
    res.status(400).json({ message: "Failed to update post" });
  }
});
/**
 * @openapi
 * /api/posts/{postId}/comments:
 *   get:
 *     summary: Get comments for a blog post
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of comments
 */
// --- GET /api/posts/:postId/comments (Get comments) ---
app.get(api.comments.list.path, async (req: Request, res: Response) => {
  const postId = Number(req.params.postId);

  try {
    const postComments = await db.select().from(comments)
      .where(eq(comments.postId, postId));

    // Get user info for each comment
    const commentsWithUsers = await Promise.all(
      postComments.map(async (comment) => ({
        ...comment,
        user: await storage.getUser(comment.userId)
      }))
    );

    res.json(commentsWithUsers);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Failed to fetch comments" });
  }
});

/**
 * @openapi
 * /api/posts/{postId}/comments:
 *   post:
 *     summary: Add comment to blog post
 *     tags: [Comments]
 */
// --- POST /api/posts/:postId/comments (Add comment) ---
app.post(api.comments.create.path, authenticateToken, async (req: Request, res: Response) => {
  const postId = Number(req.params.postId);
  const userId = (req as any).user.id;
  const { content } = req.body;

  try {
    const newComment = await db.insert(comments)
      .values({ postId, userId, content })
      .returning();

    res.status(201).json(newComment[0]);
  } catch (err) {
    res.status(400).json({ message: "Failed to create comment" });
  }
});

/**
 * @openapi
 * /api/comments/{id}:
 *   delete:
 *     summary: Delete comment
 *     tags: [Comments]
 */
// --- DELETE /api/comments/:id (Delete comment) ---
app.delete(api.comments.delete.path, authenticateToken, async (req: Request, res: Response) => {
  const commentId = Number(req.params.id);
  const userId = (req as any).user.id;
  const userRole = (req as any).user.role;

  try {
    const comment = await db.select().from(comments).where(eq(comments.id, commentId));

    if (!comment[0]) return res.status(404).json({ message: "Comment not found" });

    // Only author of comment or admin can delete
    if (comment[0].userId !== userId && userRole !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    await db.delete(comments).where(eq(comments.id, commentId));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: "Failed to delete comment" });
  }
});

app.patch(api.comments.update.path, authenticateToken, async (req: Request, res: Response) => {
  const commentId = Number(req.params.id);
  const userId = (req as any).user.id;
  const userRole = (req as any).user.role;
  const { content } = req.body;

  try {
    const comment = await db.select().from(comments).where(eq(comments.id, commentId));

    if (!comment[0]) return res.status(404).json({ message: "Comment not found" });

    // Only the author of the comment or an admin can edit
    if (comment[0].userId !== userId && userRole !== "admin") {
      return res.status(403).json({ message: "Not authorized to edit this comment" });
    }

    const [updated] = await db
      .update(comments)
      .set({ content })
      .where(eq(comments.id, commentId))
      .returning();

    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ message: "Failed to update comment" });
  }
});  


  app.get(api.posts.list.path, async (req, res) => {
    const posts = await storage.getBlogPosts(req.query.genre as string);
    res.json(posts);
  });

  /**
   * @openapi
   * /api/posts/{id}:
   *   get:
   *     summary: Get a blog post by ID
   *     tags: [Posts]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200:
   *         description: Blog post details
   */
  app.get(api.posts.get.path, optionalAuth, async (req, res) => {
    const postId = Number(req.params.id);
    let post = await storage.getBlogPost(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    const author = post.authorId ? await storage.getUser(post.authorId) : null;
    if (author) await storage.incrementUserBlogs(author.id);

    const userId = (req as any).user?.id;
    let likedByMe = false;
    if (userId) {
      // Only counts a view the first time this user opens this post -
      // recordView is a no-op (no views++) on every subsequent visit.
      post = await storage.recordView(postId, userId);
      likedByMe = await storage.hasUserLikedPost(postId, userId);
    }

    res.json({ ...post, author, likedByMe });
  });

  /**
   * @openapi
   * /api/posts/{id}/like:
   *   post:
   *     summary: Like a blog post
   *     tags: [Posts]
   *     security:
   *       - bearerAuth: []
   */
  app.post(api.posts.like.path, authenticateToken, async (req: Request, res: Response) => {
    const postId = Number(req.params.id);
    const userId = (req as any).user.id;

    const existingPost = await storage.getBlogPost(postId);
    if (!existingPost) return res.status(404).json({ message: "Post not found" });

    const post = await storage.likePost(postId, userId);
    res.json({ post, liked: true });
  });

  /**
   * @openapi
   * /api/posts/{id}/like:
   *   delete:
   *     summary: Unlike a blog post
   *     tags: [Posts]
   *     security:
   *       - bearerAuth: []
   */
  app.delete(api.posts.unlike.path, authenticateToken, async (req: Request, res: Response) => {
    const postId = Number(req.params.id);
    const userId = (req as any).user.id;

    const existingPost = await storage.getBlogPost(postId);
    if (!existingPost) return res.status(404).json({ message: "Post not found" });

    const post = await storage.unlikePost(postId, userId);
    res.json({ post, liked: false });
  });

  /**
   * @openapi
   * /api/contact:
   *   post:
   *     summary: Send a contact message
   *     tags: [Contact]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [fullName, email, message]
   *             properties:
   *               fullName: { type: string }
   *               email: { type: string }
   *               message: { type: string }
   *     responses:
   *       201:
   *         description: Message sent successfully
   */
  app.post(api.messages.create.path, async (req, res) => {
    try {
      const input = api.messages.create.input.parse(req.body);
      const message = await storage.createMessage(input);
      res.status(201).json(message);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.messages.list.path, authenticateToken, isAdmin, async (req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  // --- Image Routes ---
  app.get(api.images.list.path, async (req, res) => {
    const images = await storage.getHomeImages(req.query.type as string);
    res.json(images);
  });

  app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    const allPosts = await db.select().from(blogPosts);
    const allMessages = await db.select().from(messages);
    const allComments = await db.select().from(comments);

    res.status(200).json({
      users: allUsers,
      posts: allPosts,
      messages: allMessages,
      comments: allComments,
    });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
});

  return httpServer;
}


