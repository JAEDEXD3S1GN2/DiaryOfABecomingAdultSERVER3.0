import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import {
  users, blogPosts, comments, messages, homeImages,
  type User, type InsertUser,
  type BlogPost, type InsertBlogPost,
  type Comment, type InsertComment,
  type Message, type InsertMessage,
  type HomeImage
} from "./shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { role?: string }): Promise<User>;
  incrementUserBlogs(id: number): Promise<void>;
  incrementUserComments(id: number): Promise<void>;
  
  // Blog Posts
  getBlogPosts(genre?: string, search?: string): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: number): Promise<void>;
  
  // Comments
  getComments(postId: number): Promise<(Comment & { user: User })[]>;
  getComment(id: number): Promise<Comment | undefined>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(id: number): Promise<void>;
  
  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(): Promise<Message[]>;

  // Home Images
  getHomeImages(type?: string): Promise<HomeImage[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser & { role?: string }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async incrementUserBlogs(id: number): Promise<void> {
    const user = await this.getUser(id);
    if (user) {
      await db.update(users).set({ blogsOpened: (user.blogsOpened || 0) + 1 }).where(eq(users.id, id));
    }
  }

  async incrementUserComments(id: number): Promise<void> {
    const user = await this.getUser(id);
    if (user) {
      await db.update(users).set({ commentsMade: (user.commentsMade || 0) + 1 }).where(eq(users.id, id));
    }
  }

  async getBlogPosts(genre?: string, search?: string): Promise<BlogPost[]> {
    let query = db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
    if (genre) {
      query = query.where(eq(blogPosts.genre, genre)) as any;
    }
    return await query;
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [newPost] = await db.insert(blogPosts).values(post).returning();
    return newPost;
  }

  async updateBlogPost(id: number, updates: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [updatedPost] = await db.update(blogPosts).set(updates).where(eq(blogPosts.id, id)).returning();
    return updatedPost;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async getComments(postId: number): Promise<(Comment & { user: User })[]> {
    const result = await db.select({
      comment: comments,
      user: users
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(desc(comments.createdAt));
    
    return result.map(r => ({ ...r.comment, user: r.user }));
  }

  async getComment(id: number): Promise<Comment | undefined> {
    const [comment] = await db.select().from(comments).where(eq(comments.id, id));
    return comment;
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const [newComment] = await db.insert(comments).values(comment).returning();
    return newComment;
  }

  async deleteComment(id: number): Promise<void> {
    await db.delete(comments).where(eq(comments.id, id));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async getMessages(): Promise<Message[]> {
    return await db.select().from(messages).orderBy(desc(messages.createdAt));
  }

  async getHomeImages(type?: string): Promise<HomeImage[]> {
    let query = db.select().from(homeImages);
    if (type) {
      query = query.where(eq(homeImages.type, type)) as any;
    }
    return await query;
  }
}

export const storage = new DatabaseStorage();

