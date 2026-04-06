/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  deleteDoc, 
  doc,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Ticket, 
  Users, 
  LogOut, 
  LogIn, 
  Send, 
  Trash2, 
  RefreshCw, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { cn } from './lib/utils';
import { format } from 'date-fns';

// --- Types ---
interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  createdAt: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
  }
}

// --- Helpers ---
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const LottoBall = ({ number }: { number: number }) => {
  const getColor = (n: number) => {
    if (n <= 10) return 'bg-yellow-400 text-yellow-900';
    if (n <= 20) return 'bg-blue-400 text-white';
    if (n <= 30) return 'bg-red-400 text-white';
    if (n <= 40) return 'bg-gray-400 text-white';
    return 'bg-green-400 text-white';
  };

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-lg",
        getColor(number)
      )}
    >
      {number}
    </motion.div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [numbers, setNumbers] = useState<number[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [activeTab, setActiveTab] = useState<'lotto' | 'community'>('lotto');
  const [isGenerating, setIsGenerating] = useState(false);

  // Test connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Community Posts
  useEffect(() => {
    if (!isAuthReady || !user) {
      setPosts([]);
      return;
    }

    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p: Post[] = [];
      snapshot.forEach((doc) => {
        p.push({ id: doc.id, ...doc.data() } as Post);
      });
      setPosts(p);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });

    return unsubscribe;
  }, [isAuthReady, user]);

  const generateNumbers = () => {
    setIsGenerating(true);
    setNumbers([]);
    
    setTimeout(() => {
      const newNumbers: number[] = [];
      while (newNumbers.length < 6) {
        const r = Math.floor(Math.random() * 45) + 1;
        if (!newNumbers.includes(r)) {
          newNumbers.push(r);
        }
      }
      setNumbers(newNumbers.sort((a, b) => a - b));
      setIsGenerating(false);
    }, 600);
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = () => signOut(auth);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !user) return;

    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        authorPhoto: user.photoURL || '',
        content: newPost,
        createdAt: serverTimestamp(),
      });
      setNewPost('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    }
  };

  const deletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">Lucky Lotto</h1>
          </div>
          
          {user ? (
            <div className="flex items-center gap-3">
              <img 
                src={user.photoURL || ''} 
                alt={user.displayName || ''} 
                className="w-8 h-8 rounded-full border border-slate-200"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={logout}
                className="p-2 text-slate-500 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={login}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Mobile Tabs */}
        <div className="flex md:hidden bg-white rounded-xl p-1 mb-6 shadow-sm border border-slate-200">
          <button 
            onClick={() => setActiveTab('lotto')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-all",
              activeTab === 'lotto' ? "bg-blue-600 text-white shadow-md" : "text-slate-500"
            )}
          >
            <Ticket className="w-4 h-4" />
            <span>Lotto</span>
          </button>
          <button 
            onClick={() => setActiveTab('community')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-all",
              activeTab === 'community' ? "bg-blue-600 text-white shadow-md" : "text-slate-500"
            )}
          >
            <Users className="w-4 h-4" />
            <span>Community</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Lotto Section */}
          <section className={cn(
            "md:col-span-5 space-y-6",
            activeTab !== 'lotto' && "hidden md:block"
          )}>
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center space-y-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-800">행운의 번호</h2>
                <p className="text-slate-500">오늘의 행운을 시험해보세요!</p>
              </div>

              <div className="flex flex-wrap justify-center gap-3 min-h-[60px]">
                <AnimatePresence mode="popLayout">
                  {numbers.length > 0 ? (
                    numbers.map((num, idx) => (
                      <LottoBall key={`${num}-${idx}`} number={num} />
                    ))
                  ) : (
                    <div className="flex gap-3">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="w-12 h-12 rounded-full bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 font-bold">
                          ?
                        </div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={generateNumbers}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <RefreshCw className={cn("w-6 h-6", isGenerating && "animate-spin")} />
                {isGenerating ? "추첨 중..." : "번호 생성하기"}
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex gap-4">
              <div className="bg-blue-100 p-2 rounded-lg h-fit">
                <AlertCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-sm text-blue-800 leading-relaxed">
                <p className="font-semibold mb-1">알림</p>
                이 서비스는 재미를 위한 번호 추천 서비스입니다. 실제 당첨을 보장하지 않습니다.
              </div>
            </div>
          </section>

          {/* Community Section */}
          <section className={cn(
            "md:col-span-7 space-y-6",
            activeTab !== 'community' && "hidden md:block"
          )}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                행운 나눔 게시판
              </h2>
              <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded-full">
                {posts.length} Posts
              </span>
            </div>

            {user ? (
              <form onSubmit={handlePost} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="행운의 기운을 나눠주세요!"
                  className="w-full min-h-[100px] p-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 resize-none text-slate-800 placeholder:text-slate-400"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newPost.trim()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>등록</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-300 space-y-4">
                <p className="text-slate-500">커뮤니티에 참여하려면 로그인이 필요합니다.</p>
                <button 
                  onClick={login}
                  className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl font-medium hover:bg-slate-800 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Google로 로그인</span>
                </button>
              </div>
            )}

            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {posts.map((post) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img 
                          src={post.authorPhoto} 
                          alt={post.authorName} 
                          className="w-10 h-10 rounded-full border border-slate-100"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="font-bold text-slate-800">{post.authorName}</p>
                          <p className="text-xs text-slate-400">
                            {post.createdAt?.toDate ? format(post.createdAt.toDate(), 'yyyy.MM.dd HH:mm') : 'Just now'}
                          </p>
                        </div>
                      </div>
                      {user?.uid === post.authorId && (
                        <button 
                          onClick={() => deletePost(post.id)}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>

              {posts.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  아직 게시물이 없습니다. 첫 번째 행운을 나눠보세요!
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Desktop Footer */}
      <footer className="hidden md:block py-12 border-t border-slate-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-slate-400 text-sm">
          <p>© 2026 Lucky Lotto. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
