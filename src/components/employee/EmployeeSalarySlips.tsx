import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Download, Eye, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Textarea } from '../ui/textarea';
import { useAuth } from '../../hooks/useAuth';
import { database } from '../../firebase';
import { ref, onValue, off } from 'firebase/database';
import { toast } from 'react-hot-toast';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { generateSalarySlipPDF } from '../../utils/pdfGenerator';

interface SalarySlip {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  generatedAt: string;
  status: 'generated' | 'sent';
  sentAt?: string;
  updates?: Record<string, SalaryUpdate>;
  comments?: Record<string, Comment>;
}

interface SalaryUpdate {
  timestamp: string;
  updatedBy: string;
  updatedById: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  note?: string;
}

interface Comment {
  text: string;
  createdAt: string;
  createdBy: string;
  createdById: string;
}

const EmployeeSalarySlips = () => {
  const { user } = useAuth();
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSlip, setSelectedSlip] = useState<SalarySlip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSlips, setExpandedSlips] = useState<Record<string, boolean>>({});
  const [newComment, setNewComment] = useState<string>('');

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    if (!user?.id || !user?.adminUid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const salaryRef = ref(database, `users/${user.adminUid}/employees/${user.id}/salary`);
    
    const fetchSalaries = onValue(salaryRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const salaryData: SalarySlip[] = Object.entries(data).map(([key, value]) => ({
            id: key,
            ...(value as Omit<SalarySlip, 'id'>),
            updates: (value as any).updates || {},
            comments: (value as any).comments || {}
          }));
          setSalarySlips(salaryData);
        } else {
          setSalarySlips([]);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error loading salary slips:", error);
        toast.error("Failed to load salary slips");
        setError("Failed to load salary data");
        setLoading(false);
      }
    }, (error) => {
      console.error("Error setting up listener:", error);
      toast.error("Failed to load salary slips");
      setError("Failed to load salary data");
      setLoading(false);
    });

    return () => {
      off(salaryRef);
    };
  }, [user]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const downloadSlip = (slip: SalarySlip) => {
    const slipContent = `
SALARY SLIP
===========

Employee: ${slip.employeeName}
Employee ID: ${slip.employeeId}
Month: ${months[slip.month]} ${slip.year}
Generated: ${new Date(slip.generatedAt).toLocaleDateString()}

EARNINGS:
Basic Salary: ${formatCurrency(slip.basicSalary)}
Allowances: ${formatCurrency(slip.allowances)}
Total Earnings: ${formatCurrency(slip.basicSalary + slip.allowances)}

DEDUCTIONS:
Tax & Other Deductions: ${formatCurrency(slip.deductions)}

NET SALARY: ${formatCurrency(slip.netSalary)}

This is a computer-generated salary slip.
    `;

    const blob = new Blob([slipContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary-slip-${months[slip.month]}-${slip.year}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadSlipAsPDF = (slip: SalarySlip) => {
    const pdfData = {
      employeeName: slip.employeeName,
      employeeId: slip.employeeId,
      month: months[slip.month],
      year: slip.year,
      basicSalary: slip.basicSalary,
      allowances: slip.allowances,
      deductions: slip.deductions,
      netSalary: slip.netSalary,
      generatedAt: slip.generatedAt,
      companyName: 'Your Company Name',
      companyAddress: 'Your Company Address'
    };
    
    generateSalarySlipPDF(pdfData);
    
    toast.success(`Salary slip PDF downloaded for ${months[slip.month]} ${slip.year}`);
  };

  const addComment = async (slipId: string) => {
    if (!user?.id || !user?.adminUid || !newComment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    try {
      const timestamp = Date.now().toString();
      const commentData: Comment = {
        text: newComment,
        createdAt: new Date().toISOString(),
        createdBy: user.name || 'Employee',
        createdById: user.id
      };

      // Add comment to admin's record
      const adminCommentRef = ref(
        database,
        `users/${user.adminUid}/employees/${user.id}/salary/${slipId}/comments/${timestamp}`
      );
      await set(adminCommentRef, commentData);

      // Update local state
      setSalarySlips(prev => 
        prev.map(slip => {
          if (slip.id !== slipId) return slip;
          
          const updatedComments = { ...slip.comments };
          updatedComments[timestamp] = commentData;

          return {
            ...slip,
            comments: updatedComments
          };
        })
      );

      toast.success("Comment added successfully");
      setNewComment('');
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
  };

  const toggleSlipExpand = (slipId: string) => {
    setExpandedSlips(prev => ({
      ...prev,
      [slipId]: !prev[slipId]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generated': return 'bg-blue-100 text-blue-700';
      case 'sent': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredSlips = salarySlips.filter(slip => slip.year === selectedYear);

  const getSalaryStats = () => {
    const currentYear = new Date().getFullYear();
    const currentYearSlips = salarySlips.filter(slip => slip.year === currentYear);
    
    const totalEarnings = currentYearSlips.reduce((sum, slip) => sum + slip.netSalary, 0);
    const avgSalary = currentYearSlips.length > 0 ? totalEarnings / currentYearSlips.length : 0;
    const highestSalary = currentYearSlips.length > 0 ? Math.max(...currentYearSlips.map(slip => slip.netSalary)) : 0;
    
    return { 
      totalEarnings, 
      avgSalary, 
      highestSalary, 
      slipsReceived: currentYearSlips.length 
    };
  };

  const stats = getSalaryStats();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">{error}</div>
        <Button 
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Salary Slips</h1>
          <p className="text-gray-600">View and download your salary slips</p>
        </div>
      </motion.div>

      {/* Salary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Earnings</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.totalEarnings)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Average Salary</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.avgSalary)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Highest Salary</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.highestSalary)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Slips Received</p>
                  <p className="text-lg font-bold">{stats.slipsReceived}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Filter Salary Slips</CardTitle>
          </CardHeader>
          <CardContent>
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </motion.div>

      {/* Salary Slips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Salary Slips - {selectedYear} ({filteredSlips.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredSlips.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No salary slips found for {selectedYear}
                </div>
              ) : (
                filteredSlips.map((slip) => {
                  const updates = slip.updates 
                    ? Object.entries(slip.updates)
                        .sort(([a], [b]) => parseInt(b) - parseInt(a))
                        .map(([timestamp, update]) => ({ timestamp, ...update }))
                    : [];
                  
                  const comments = slip.comments 
                    ? Object.entries(slip.comments)
                        .sort(([a], [b]) => parseInt(b) - parseInt(a))
                        .map(([timestamp, comment]) => ({ timestamp, ...comment }))
                    : [];

                  return (
                    <div key={slip.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">
                              {months[slip.month]} {slip.year}
                            </h3>
                            <Badge className={getStatusColor(slip.status)}>
                              {slip.status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                            <div>
                              <p className="font-medium">Basic Salary</p>
                              <p>{formatCurrency(slip.basicSalary)}</p>
                            </div>
                            <div>
                              <p className="font-medium">Allowances</p>
                              <p>{formatCurrency(slip.allowances)}</p>
                            </div>
                            <div>
                              <p className="font-medium">Deductions</p>
                              <p>{formatCurrency(slip.deductions)}</p>
                            </div>
                            <div>
                              <p className="font-medium">Net Salary</p>
                              <p className="text-green-600 font-semibold">{formatCurrency(slip.netSalary)}</p>
                            </div>
                          </div>
                          
                          <p className="text-xs text-gray-500">
                            Generated: {formatDate(slip.generatedAt)} {formatTime(slip.generatedAt)}
                            {slip.sentAt && (
                              <> • Sent: {formatDate(slip.sentAt)} {formatTime(slip.sentAt)}</>
                            )}
                          </p>
                        </div>
                        
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSlip(slip)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadSlipAsPDF(slip)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => downloadSlip(slip)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Text
                          </Button>
                        </div>
                      </div>

                      {(updates.length > 0 || comments.length > 0) && (
                        <div className="border-t pt-3">
                          <Collapsible>
                            <CollapsibleTrigger 
                              className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-md"
                              onClick={() => toggleSlipExpand(slip.id)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {updates.length > 0 ? 'History' : ''}
                                  {updates.length > 0 && comments.length > 0 ? ' & ' : ''}
                                  {comments.length > 0 ? 'Comments' : ''}
                                </span>
                              </div>
                              {expandedSlips[slip.id] ? 
                                <ChevronUp className="h-4 w-4" /> : 
                                <ChevronDown className="h-4 w-4" />
                              }
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-2 space-y-4">
                              {/* Updates */}
                              {updates.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Update History</h4>
                                  <div className="space-y-2">
                                    {updates.map((update, idx) => (
                                      <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                                        <div className="flex justify-between">
                                          <span className="font-medium">{update.updatedBy}</span>
                                          <span className="text-gray-500">
                                            {formatDate(update.timestamp)} {formatTime(update.timestamp)}
                                          </span>
                                        </div>
                                        <div className="mt-1">
                                          {update.changes.map((change, i) => (
                                            <p key={i}>
                                              Changed <span className="font-medium">{change.field}</span> from 
                                              <span className="italic"> "{change.oldValue}"</span> to 
                                              <span className="font-medium"> "{change.newValue}"</span>
                                            </p>
                                          ))}
                                        </div>
                                        {update.note && (
                                          <p className="mt-1 italic">Note: "{update.note}"</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Comments */}
                              {comments.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Comments</h4>
                                  <div className="space-y-2">
                                    {comments.map((comment, idx) => (
                                      <div key={idx} className="text-sm bg-gray-50 p-3 rounded-lg">
                                        <p className="text-gray-700">{comment.text}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                          {comment.createdBy} • {formatDate(comment.createdAt)} • {formatTime(comment.createdAt)}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Add Comment */}
                              <div className="space-y-2">
                                <Textarea
                                  placeholder="Add a comment..."
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                />
                                <Button 
                                  size="sm"
                                  onClick={() => addComment(slip.id)}
                                >
                                  Add Comment
                                </Button>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Salary Slip Detail Modal */}
      {selectedSlip && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedSlip(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Salary Slip Details</h3>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setSelectedSlip(null)}
              >
                ×
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="text-center border-b pb-4">
                <h4 className="font-semibold">{months[selectedSlip.month]} {selectedSlip.year}</h4>
                <p className="text-sm text-gray-600">{selectedSlip.employeeName}</p>
                <p className="text-sm text-gray-600">ID: {selectedSlip.employeeId}</p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-green-600">Earnings</h4>
                <div className="flex justify-between">
                  <span>Basic Salary:</span>
                  <span>{formatCurrency(selectedSlip.basicSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Allowances:</span>
                  <span>{formatCurrency(selectedSlip.allowances)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Total Earnings:</span>
                  <span>{formatCurrency(selectedSlip.basicSalary + selectedSlip.allowances)}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Deductions</h4>
                <div className="flex justify-between">
                  <span>Tax & Others:</span>
                  <span>{formatCurrency(selectedSlip.deductions)}</span>
                </div>
              </div>
              
              <div className="border-t pt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Net Salary:</span>
                  <span className="text-green-600">{formatCurrency(selectedSlip.netSalary)}</span>
                </div>
              </div>
              
              <div className="pt-4 grid grid-cols-2 gap-2">
                <Button 
                  variant="outline"
                  onClick={() => downloadSlip(selectedSlip)}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download Text
                </Button>
                <Button 
                  onClick={() => downloadSlipAsPDF(selectedSlip)}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download PDF
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default EmployeeSalarySlips;