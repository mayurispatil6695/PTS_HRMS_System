import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Checkbox } from '../../ui/checkbox';
import { Badge } from '../../ui/badge';
import { Bell, Plus, Users, Calendar, Flag, User, Clock, DollarSign, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';

interface Employee {
  id: string;
  name: string;
  department: string;
  designation: string;
  email: string;
  avatar?: string;
}

interface ProjectFormData {
  name: string;
  description: string;
  department: string;
  assignedEmployees: string[];
  teamLead: string;
  startDate: string;
  endDate: string;
  priority: string;
  status: string;
  budget?: number;
  client?: string;
  tags: string[];
}

interface ProjectFormProps {
  formData: ProjectFormData;
  setFormData: (data: ProjectFormData) => void;
  employees: Employee[];
  currentUser: Employee;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const ProjectForm: React.FC<ProjectFormProps> = ({
  formData,
  setFormData,
  employees,
  currentUser,
  onSubmit,
  onCancel
}) => {
  const departments = ['Software', 'Digital Marketing', 'Sales', 'Product Designing', 'Web Development', 'Graphic Designing', ' Artificial Intelligence'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const statuses = ['not_started', 'in_progress', 'on_hold', 'completed'];
  const allTags = ['Frontend', 'Backend', 'UI/UX', 'E-commerce', 'Mobile', 'SEO', 'CMS'];

  const [newTag, setNewTag] = useState('');
  const [isTeamSectionOpen, setIsTeamSectionOpen] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>(employees);

  // Filter employees based on selected department
  useEffect(() => {
    if (formData.department) {
      const filtered = employees.filter(emp => 
        emp.department.toLowerCase() === formData.department.toLowerCase()
      );
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees);
    }
  }, [formData.department, employees]);

  // Group employees by designation for the current department
  const teamLeads = filteredEmployees.filter(emp => 
    emp.designation.toLowerCase().includes('lead') || 
    emp.designation.toLowerCase().includes('manager')
  );
  
  const regularEmployees = filteredEmployees.filter(emp => 
    !emp.designation.toLowerCase().includes('lead') && 
    !emp.designation.toLowerCase().includes('manager')
  );

  const handleEmployeeAssignment = (employeeId: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        assignedEmployees: [...formData.assignedEmployees, employeeId]
      });
    } else {
      setFormData({
        ...formData,
        assignedEmployees: formData.assignedEmployees.filter(id => id !== employeeId)
      });
    }
  };

  const handleTeamLeadChange = (value: string) => {
    const newFormData = {
      ...formData,
      teamLead: value
    };
    
    // If the selected team lead isn't already assigned, add them
    if (!formData.assignedEmployees.includes(value)) {
      newFormData.assignedEmployees = [...formData.assignedEmployees, value];
    }
    
    setFormData(newFormData);
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  // Set current user as team lead by default if they're a lead/manager in the selected department
  useEffect(() => {
    if (currentUser && !formData.teamLead && formData.department) {
      const isLeadership = currentUser.designation.toLowerCase().includes('lead') || 
                         currentUser.designation.toLowerCase().includes('manager');
      const isInDepartment = currentUser.department.toLowerCase() === formData.department.toLowerCase();
      
      if (isLeadership && isInDepartment) {
        setFormData(prev => ({
          ...prev,
          teamLead: currentUser.id,
          assignedEmployees: [...prev.assignedEmployees, currentUser.id]
        }));
      }
    }
  }, [currentUser, formData.teamLead, formData.department, setFormData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto"
    >
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <motion.div 
              whileHover={{ rotate: 90 }}
              transition={{ duration: 0.3 }}
            >
              <Plus className="h-6 w-6" />
            </motion.div>
            Create New Project
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Basic Project Info */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Name</label>
                <Input
                  placeholder="Enter project name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <Select 
                  value={formData.department} 
                  onValueChange={(value) => setFormData({...formData, department: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary"></span>
                          {dept}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <label className="text-sm font-medium">Project Description</label>
              <Textarea
                placeholder="Describe the project scope, objectives, and deliverables..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={4}
                required
              />
            </motion.div>

            {/* Client & Budget */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Client
                </label>
                <Input
                  placeholder="Client name or company"
                  value={formData.client || ''}
                  onChange={(e) => setFormData({...formData, client: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Budget ($)
                </label>
                <Input
                  type="number"
                  placeholder="Estimated budget"
                  value={formData.budget || ''}
                  onChange={(e) => setFormData({...formData, budget: Number(e.target.value)})}
                  min="0"
                />
              </div>
            </motion.div>

            {/* Tags */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="space-y-2"
            >
              <label className="text-sm font-medium">Project Tags</label>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {formData.tags.map(tag => (
                    <motion.div
                      key={tag}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Badge 
                        variant="secondary" 
                        className="flex items-center gap-1 cursor-pointer hover:bg-primary/10"
                        onClick={() => removeTag(tag)}
                      >
                        {tag}
                        <span className="text-xs">×</span>
                      </Badge>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Add new tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  className="w-auto"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={addTag}
                  disabled={!newTag.trim()}
                >
                  Add
                </Button>
                <Select onValueChange={(value) => {
                  if (!formData.tags.includes(value)) {
                    setFormData({
                      ...formData,
                      tags: [...formData.tags, value]
                    });
                  }
                }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Common tags" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>

            {/* Team Section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="space-y-4 border rounded-lg p-4"
            >
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setIsTeamSectionOpen(!isTeamSectionOpen)}
              >
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Assignment
                </h3>
                {isTeamSectionOpen ? <ChevronUp /> : <ChevronDown />}
              </div>

              <AnimatePresence>
                {isTeamSectionOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-6 pt-4">
                      {/* Team Lead Selection */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Team Lead</label>
                        <Select 
                          value={formData.teamLead} 
                          onValueChange={handleTeamLeadChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select team lead" />
                          </SelectTrigger>
                          <SelectContent>
                            {teamLeads.length > 0 ? (
                              <>
                                <div className="px-1 py-1.5 text-xs text-muted-foreground">
                                  {formData.department || 'All'} Department Leads
                                </div>
                                {teamLeads.map(lead => (
                                  <SelectItem key={lead.id} value={lead.id}>
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage src={lead.avatar} />
                                        <AvatarFallback>
                                          {lead.name.charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <div className="font-medium">{lead.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {lead.designation}
                                        </div>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </>
                            ) : (
                              <div className="px-1 py-1.5 text-xs text-muted-foreground">
                                No leads found in {formData.department || 'selected'} department
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Team Members */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Team Members</label>
                        <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                          {regularEmployees.length === 0 ? (
                            <p className="text-gray-500 text-sm">No employees available in {formData.department || 'selected'} department</p>
                          ) : (
                            <div className="space-y-3">
                              {regularEmployees.map(employee => (
                                <motion.div 
                                  key={employee.id}
                                  whileHover={{ scale: 1.01 }}
                                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50"
                                >
                                  <Checkbox
                                    id={`member-${employee.id}`}
                                    checked={formData.assignedEmployees.includes(employee.id)}
                                    onCheckedChange={(checked) => handleEmployeeAssignment(employee.id, !!checked)}
                                  />
                                  <label 
                                    htmlFor={`member-${employee.id}`} 
                                    className="flex-1 cursor-pointer"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage src={employee.avatar} />
                                        <AvatarFallback>
                                          {employee.name.charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1">
                                        <div className="font-medium">{employee.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {employee.designation} • {employee.department}
                                        </div>
                                      </div>
                                      {formData.teamLead === employee.id && (
                                        <Badge variant="default" className="text-xs">
                                          Lead
                                        </Badge>
                                      )}
                                    </div>
                                  </label>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                        {formData.assignedEmployees.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formData.assignedEmployees.length} member(s) selected
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Timeline & Status */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="space-y-2 border rounded-lg p-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Timeline
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Start Date</label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">End Date</label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 border rounded-lg p-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Flag className="h-4 w-4" />
                  Project Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Priority</label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map(priority => (
                          <SelectItem key={priority} value={priority}>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full ${
                                priority === 'urgent' ? 'bg-red-500' :
                                priority === 'high' ? 'bg-orange-500' :
                                priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                              }`}></span>
                              {priority.charAt(0).toUpperCase() + priority.slice(1)}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Status</label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map(status => (
                          <SelectItem key={status} value={status}>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full ${
                                status === 'completed' ? 'bg-green-500' :
                                status === 'in_progress' ? 'bg-blue-500' :
                                status === 'on_hold' ? 'bg-yellow-500' : 'bg-gray-500'
                              }`}></span>
                              {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Project Preview Toggle */}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                className="gap-2"
              >
                {isPreviewOpen ? 'Hide Preview' : 'Show Preview'}
                {isPreviewOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onCancel}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="gap-2"
                >
                  <Bell className="h-4 w-4" />
                  Create Project
                </Button>
              </div>
            </div>

            {/* Integrated Project Preview */}
            <AnimatePresence>
              {isPreviewOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <Card className="border border-primary/20 mt-4">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-xl">{formData.name || 'Project Name'}</CardTitle>
                        <Badge 
                          variant="outline" 
                          className={`${
                            formData.priority === 'urgent' ? 'border-red-500 text-red-500' :
                            formData.priority === 'high' ? 'border-orange-500 text-orange-500' :
                            formData.priority === 'medium' ? 'border-yellow-500 text-yellow-500' : 'border-green-500 text-green-500'
                          }`}
                        >
                          {formData.priority ? formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1) : 'Priority'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Briefcase className="h-4 w-4" />
                        <span>{formData.client || 'No client specified'}</span>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {formData.description || 'No description provided'}
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {formData.tags.map(tag => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Team
                            </h4>
                            <div className="flex items-center -space-x-2">
                              {formData.assignedEmployees.slice(0, 5).map(empId => {
                                const emp = employees.find(e => e.id === empId);
                                return emp ? (
                                  <Avatar key={emp.id} className="h-8 w-8 border-2 border-background">
                                    <AvatarImage src={emp.avatar} />
                                    <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                ) : null;
                              })}
                              {formData.assignedEmployees.length > 5 && (
                                <Avatar className="h-8 w-8 border-2 border-background">
                                  <AvatarFallback className="text-xs">
                                    +{formData.assignedEmployees.length - 5}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                            {formData.teamLead && (
                              <div className="text-xs text-muted-foreground">
                                Team Lead: {employees.find(e => e.id === formData.teamLead)?.name}
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Timeline
                            </h4>
                            <div className="text-sm">
                              {formData.startDate ? new Date(formData.startDate).toLocaleDateString() : 'Not set'} - 
                              {formData.endDate ? new Date(formData.endDate).toLocaleDateString() : 'Not set'}
                            </div>
                            {formData.budget && (
                              <div className="text-sm flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Budget: ${formData.budget.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2">
                          <Badge 
                            variant={
                              formData.status === 'completed' ? 'default' :
                              formData.status === 'in_progress' ? 'secondary' :
                              formData.status === 'on_hold' ? 'outline' : 'destructive'
                            }
                          >
                            {formData.status ? 
                              formData.status.replace('_', ' ').charAt(0).toUpperCase() + 
                              formData.status.replace('_', ' ').slice(1) : 
                              'Status not set'}
                          </Badge>
                          
                          <div className="text-xs text-muted-foreground">
                            {formData.department || 'No department'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ProjectForm;